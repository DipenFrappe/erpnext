# Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
# License: GNU General Public License v3. See license.txt

import json

import frappe
from frappe import _
from frappe.utils import cint


def _require_naming_permission():
	if not frappe.has_permission("Document Naming Rule", "write"):
		frappe.throw(_("Not permitted"), frappe.PermissionError)


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------


@frappe.whitelist()
def get_naming_rules():
	"""Return all Document Naming Rules with their conditions, ordered by priority."""
	rules = frappe.get_all(
		"Document Naming Rule",
		fields=["name", "document_type", "prefix", "prefix_digits", "priority", "disabled", "counter"],
		order_by="priority desc, creation asc",
	)

	for rule in rules:
		conditions = frappe.get_all(
			"Document Naming Rule Condition",
			filters={"parent": rule.name},
			fields=["field", "condition", "value"],
			order_by="idx asc",
		)
		rule["conditions"] = conditions

		company_cond = next((c for c in conditions if c.field == "company"), None)
		rule["company"] = company_cond.value if company_cond else ""
		# Strip the trailing separator for display
		rule["prefix_display"] = rule.prefix.rstrip("-") if rule.prefix else ""

	return rules


@frappe.whitelist()
def get_companies():
	"""Return all companies with their abbreviations."""
	return frappe.get_all("Company", fields=["name", "abbr"], order_by="name asc")


@frappe.whitelist()
def get_company_details(company):
	"""Return abbreviation for a given company."""
	abbr = frappe.db.get_value("Company", company, "abbr") or ""
	return {"abbr": abbr}


@frappe.whitelist()
def get_fiscal_years():
	"""Return all fiscal years, most recent first."""
	return frappe.get_all(
		"Fiscal Year",
		fields=["name", "year_start_date", "year_end_date"],
		order_by="year_start_date desc",
	)


# ---------------------------------------------------------------------------
# Write helpers
# ---------------------------------------------------------------------------


@frappe.whitelist()
def save_naming_rule(config):
	"""
	Create or update a Document Naming Rule from the visual builder config.

	config fields:
	  doctype            – target DocType
	  company            – company name (empty = all companies)
	  company_abbr       – company abbreviation literal
	  fiscal_year        – fiscal year name (e.g. "2026-2027"), optional
	  fiscal_year_abbr   – pre-computed abbreviation (e.g. "26-27"), optional
	  prefix_components  – list of {type, value, display}
	  digits             – number of counter digits (int)
	  priority           – rule priority (int, higher = evaluated first)
	  rule_name          – existing Document Naming Rule name when editing
	"""
	_require_naming_permission()

	if isinstance(config, str):
		config = json.loads(config)

	_validate_config(config)

	prefix = _build_prefix(config)
	conditions = _build_conditions(config)
	digits = cint(config.get("digits", 5))
	priority = cint(config.get("priority", 0))
	rule_name = config.get("rule_name")

	if rule_name and frappe.db.exists("Document Naming Rule", rule_name):
		doc = frappe.get_doc("Document Naming Rule", rule_name)
		doc.document_type = config["doctype"]
		doc.prefix = prefix
		doc.prefix_digits = digits
		doc.priority = priority
		doc.set("conditions", [])
		for c in conditions:
			doc.append("conditions", c)
		doc.save()
	else:
		_check_duplicate(config["doctype"], config.get("company", ""))
		doc = frappe.new_doc("Document Naming Rule")
		doc.document_type = config["doctype"]
		doc.prefix = prefix
		doc.prefix_digits = digits
		doc.priority = priority
		for c in conditions:
			doc.append("conditions", c)
		doc.insert()

	return {"rule_name": doc.name, "prefix": prefix}


@frappe.whitelist()
def delete_naming_rule(rule_name):
	_require_naming_permission()
	frappe.delete_doc("Document Naming Rule", rule_name)


@frappe.whitelist()
def toggle_naming_rule(rule_name, disabled):
	_require_naming_permission()
	frappe.db.set_value("Document Naming Rule", rule_name, "disabled", cint(disabled))


@frappe.whitelist()
def update_priorities(priorities):
	"""Bulk-update priority field for a list of {name, priority} dicts."""
	_require_naming_permission()
	if isinstance(priorities, str):
		priorities = json.loads(priorities)
	for item in priorities:
		frappe.db.set_value("Document Naming Rule", item["name"], "priority", cint(item["priority"]))


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _validate_config(config):
	if not config.get("doctype"):
		frappe.throw(_("DocType is required"))
	if not config.get("company"):
		frappe.throw(_("Company is required"))
	if not config.get("prefix_components"):
		frappe.throw(_("At least one prefix component is required"))

	for comp in config.get("prefix_components", []):
		if comp.get("type") == "static":
			val = (comp.get("value") or "").strip()
			if not val:
				frappe.throw(_("Static text components cannot be empty"))
			import re

			if not re.match(r"^[A-Za-z0-9\-]+$", val):
				frappe.throw(
					_("Static text '{0}' contains invalid characters. Only letters, numbers, and hyphens are allowed.").format(val)
				)


def _build_prefix(config):
	"""Assemble the prefix string from the ordered components list."""
	parts = []
	for comp in config.get("prefix_components", []):
		comp_type = comp.get("type")
		if comp_type == "static":
			val = (comp.get("value") or "").strip()
			if val:
				parts.append(val)
		elif comp_type == "company_abbr":
			abbr = (config.get("company_abbr") or "").strip()
			if abbr:
				parts.append(abbr)
		elif comp_type == "fiscal_year":
			fy_abbr = (config.get("fiscal_year_abbr") or "").strip()
			if fy_abbr:
				parts.append(fy_abbr)

	prefix = "-".join(parts)
	# Trailing dash is the separator Frappe expects before the counter digits
	return f"{prefix}-" if prefix else ""


def _build_conditions(config):
	"""Build the conditions list for Document Naming Rule Condition child table."""
	conditions = []
	company = (config.get("company") or "").strip()
	doctype = config["doctype"]

	if company:
		# Verify the doctype has a 'company' field before setting the condition
		docfields = [f.fieldname for f in frappe.get_meta(doctype).fields]
		if "company" in docfields:
			conditions.append({"field": "company", "condition": "=", "value": company})

	return conditions


def _check_duplicate(doctype, company):
	"""Raise if a rule for the same (doctype, company) already exists."""
	existing = frappe.get_all(
		"Document Naming Rule",
		filters={"document_type": doctype},
		fields=["name"],
	)
	for rule in existing:
		conds = frappe.get_all(
			"Document Naming Rule Condition",
			filters={"parent": rule.name, "field": "company"},
			fields=["value"],
		)
		existing_company = conds[0].value if conds else ""
		if existing_company == company:
			frappe.throw(
				_("A naming rule for {0} under {1} already exists.").format(
					frappe.bold(doctype),
					frappe.bold(company or _("All Companies")),
				)
			)
