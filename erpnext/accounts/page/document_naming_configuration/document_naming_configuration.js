// Copyright (c) 2025, Frappe Technologies Pvt. Ltd. and contributors
// License: GNU General Public License v3. See license.txt

frappe.pages["document-naming-configuration"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Document Naming Configuration"),
		single_column: true,
	});

	frappe.breadcrumbs.add("Accounts");

	new DocumentNamingConfig(page, wrapper);
};

class DocumentNamingConfig {
	constructor(page, wrapper) {
		this.page = page;
		this.wrapper = wrapper;
		this.$main = $(page.main);

		this.state = {
			view: "list", // "list" | "form"
			rules: [],
			editing: null, // rule.name being edited, or null for new
			form: this._empty_form(),
		};

		this._setup_toolbar();
		this._setup_container();
		this.load_rules();
	}

	// ── Toolbar ──────────────────────────────────────────────────────────────

	_setup_toolbar() {
		this.page.set_primary_action(__("New Naming Rule"), () => this._show_form(null), "add");
	}

	// ── Container ────────────────────────────────────────────────────────────

	_setup_container() {
		this.$main.html(`<div class="dnc-body">
			<div class="dnc-list-view"></div>
			<div class="dnc-form-view" style="display:none;"></div>
		</div>`);
		this.$list = this.$main.find(".dnc-list-view");
		this.$form = this.$main.find(".dnc-form-view");
	}

	// ── State helpers ─────────────────────────────────────────────────────────

	_empty_form() {
		return {
			doctype: "",
			company: "",
			company_abbr: "",
			fiscal_year: "",
			fiscal_year_abbr: "",
			fiscal_year_format: "short",
			use_fiscal_year: false,
			prefix_components: [],
			digits: 5,
			priority: 0,
			rule_name: null,
		};
	}

	// ── API calls ─────────────────────────────────────────────────────────────

	load_rules() {
		frappe.call({
			method: "erpnext.accounts.page.document_naming_configuration.document_naming_configuration.get_naming_rules",
			callback: (r) => {
				this.state.rules = r.message || [];
				this._render_list();
			},
		});
	}

	// ══════════════════════════════════════════════════════════════════════════
	// LIST VIEW
	// ══════════════════════════════════════════════════════════════════════════

	_render_list() {
		this.state.view = "list";
		this.$form.hide();
		this.$list.show();
		this.page.set_primary_action(__("New Naming Rule"), () => this._show_form(null), "add");

		if (!this.state.rules.length) {
			this.$list.html(this._empty_state_html());
			this._bind_empty_events();
			return;
		}

		this.$list.html(`
			<p class="dnc-page-desc">
				${__("Rules are evaluated top to bottom — the first match wins. Drag rows to reorder priority.")}
			</p>
			<div class="dnc-card">
				<div class="dnc-table-wrap">
					<table class="dnc-rules-table">
						<thead>
							<tr>
								<th style="width:70px">${__("Priority")}</th>
								<th>${__("Document Type")}</th>
								<th>${__("Company")}</th>
								<th>${__("Prefix Preview")}</th>
								<th style="width:60px; text-align:center">${__("Digits")}</th>
								<th style="width:90px">${__("Status")}</th>
								<th style="width:120px">${__("Actions")}</th>
							</tr>
						</thead>
						<tbody>
							${this.state.rules.map((r, i) => this._rule_row_html(r, i)).join("")}
						</tbody>
					</table>
				</div>
			</div>
			<div class="dnc-alert info">
				<span class="dnc-alert-icon">ℹ️</span>
				<span>${__("Rules target <strong>Document Naming Rule</strong> records in the backend — no core logic is modified.")}</span>
			</div>
		`);

		this._bind_list_events();
	}

	_rule_row_html(rule, index) {
		const company = rule.company || __("All Companies");
		const priority = rule.priority != null ? rule.priority : this.state.rules.length - index;
		const is_disabled = rule.disabled;
		const status_html = is_disabled
			? `<span class="dnc-indicator gray">${__("Inactive")}</span>`
			: `<span class="dnc-indicator green">${__("Active")}</span>`;

		return `<tr data-name="${frappe.utils.escape_html(rule.name)}" data-priority="${priority}"
				style="${is_disabled ? "opacity:0.6;" : ""}">
			<td>
				<div class="dnc-priority-cell">
					<span class="dnc-drag-handle text-muted">⠿</span>
					<span>${priority}</span>
				</div>
			</td>
			<td><strong>${frappe.utils.escape_html(rule.document_type)}</strong></td>
			<td style="color:var(--text-muted)">${frappe.utils.escape_html(company)}</td>
			<td><code class="dnc-prefix-code">${frappe.utils.escape_html(rule.prefix_display || rule.prefix || "—")}</code></td>
			<td style="text-align:center;font-weight:var(--weight-semibold)">${rule.prefix_digits}</td>
			<td>${status_html}</td>
			<td>
				<div class="btn-group btn-group-sm">
					<button class="btn btn-default btn-xs dnc-edit"
						data-name="${frappe.utils.escape_html(rule.name)}"
						title="${__("Edit")}">
						${frappe.utils.icon("edit", "sm")}
					</button>
					<button class="btn btn-default btn-xs dnc-toggle"
						data-name="${frappe.utils.escape_html(rule.name)}"
						data-disabled="${rule.disabled ? 1 : 0}"
						title="${is_disabled ? __("Enable") : __("Disable")}">
						${frappe.utils.icon(is_disabled ? "es-line-play" : "es-line-pause", "sm")}
					</button>
					<button class="btn btn-default btn-xs dnc-delete"
						data-name="${frappe.utils.escape_html(rule.name)}"
						title="${__("Delete")}"
						style="color:var(--red-500,#e03636)">
						${frappe.utils.icon("delete", "sm")}
					</button>
				</div>
			</td>
		</tr>`;
	}

	_empty_state_html() {
		return `<div class="dnc-card">
			<div class="dnc-empty">
				<div class="dnc-empty-icon">🔢</div>
				<h3>${__("No naming rules configured yet")}</h3>
				<p>${__("Create your first naming rule to control how documents like Sales Invoices and Purchase Invoices are numbered across companies and fiscal years.")}</p>
				<button class="btn btn-primary btn-lg dnc-create-first">${__("Create First Naming Rule")}</button>
				<div style="display:flex;gap:28px;justify-content:center;flex-wrap:wrap;margin-top:28px;">
					${[
						["🏢", __("Company-specific"), __("Different prefixes per company")],
						["📅", __("Fiscal Year Aware"), __("Counters reset each year")],
						["⚡", __("No Syntax Needed"), __("Visual builder — no naming series syntax")],
					]
						.map(
							([icon, title, desc]) => `
						<div style="text-align:left;max-width:160px;">
							<div style="font-size:22px;margin-bottom:6px;">${icon}</div>
							<div style="font-weight:var(--weight-semibold);font-size:var(--text-sm);margin-bottom:3px;">${title}</div>
							<div style="font-size:var(--text-xs);color:var(--text-muted);">${desc}</div>
						</div>`
						)
						.join("")}
				</div>
			</div>
		</div>`;
	}

	_bind_empty_events() {
		this.$list.find(".dnc-create-first").on("click", () => this._show_form(null));
	}

	_bind_list_events() {
		this.$list.find(".dnc-edit").on("click", (e) => {
			this._show_form($(e.currentTarget).data("name"));
		});

		this.$list.find(".dnc-delete").on("click", (e) => {
			const name = $(e.currentTarget).data("name");
			frappe.confirm(__("Delete this naming rule?"), () => {
				frappe.call({
					method: "erpnext.accounts.page.document_naming_configuration.document_naming_configuration.delete_naming_rule",
					args: { rule_name: name },
					callback: () => {
						frappe.show_alert({ message: __("Rule deleted"), indicator: "green" });
						this.load_rules();
					},
				});
			});
		});

		this.$list.find(".dnc-toggle").on("click", (e) => {
			const $btn = $(e.currentTarget);
			const name = $btn.data("name");
			const new_disabled = $btn.data("disabled") ? 0 : 1;
			frappe.call({
				method: "erpnext.accounts.page.document_naming_configuration.document_naming_configuration.toggle_naming_rule",
				args: { rule_name: name, disabled: new_disabled },
				callback: () => {
					frappe.show_alert({
						message: new_disabled ? __("Rule disabled") : __("Rule enabled"),
						indicator: new_disabled ? "orange" : "green",
					});
					this.load_rules();
				},
			});
		});
	}

	// ══════════════════════════════════════════════════════════════════════════
	// FORM VIEW
	// ══════════════════════════════════════════════════════════════════════════

	_show_form(rule_name) {
		this.state.view = "form";
		this.state.editing = rule_name;
		this.state.form = this._empty_form();

		if (rule_name) {
			const rule = this.state.rules.find((r) => r.name === rule_name);
			if (rule) this._populate_form(rule);
		}

		this.$list.hide();
		this.$form.show();
		this.page.clear_primary_action();

		this._render_form();
	}

	_populate_form(rule) {
		this.state.form = Object.assign(this.state.form, {
			doctype: rule.document_type,
			company: rule.company || "",
			digits: rule.prefix_digits,
			priority: rule.priority || 0,
			rule_name: rule.name,
			// When editing we show the stored prefix as a single static component
			// so users can see what's saved. Full component breakdown is for new rules.
			prefix_components: rule.prefix_display
				? [{ type: "static", value: rule.prefix_display, display: rule.prefix_display }]
				: [],
		});
	}

	_render_form() {
		const is_edit = !!this.state.editing;

		this.$form.html(`
			<div class="dnc-breadcrumb">
				<a class="dnc-back" href="#">← ${__("Back to Rules")}</a>
			</div>

			<p class="dnc-page-desc">
				${
					is_edit
						? __("Edit the naming rule settings below.")
						: __("Build a naming pattern using visual components — no naming-series syntax required.")
				}
			</p>

			<div class="dnc-two-col">
				<div class="dnc-cards-col">
					${this._card_doctype()}
					${this._card_company()}
					${this._card_fiscal_year()}
					${this._card_format()}
				</div>
				<div class="dnc-preview-col">
					${this._preview_panel()}
					${this._summary_card()}
				</div>
			</div>

			<div class="dnc-form-actions">
				<button class="btn btn-default dnc-cancel">${__("Cancel")}</button>
				<button class="btn btn-primary dnc-save">${__("Save Rule")}</button>
			</div>
		`);

		this._bind_form_events();
		this._update_preview();
	}

	// ── Cards ─────────────────────────────────────────────────────────────────

	_card_doctype() {
		const DOCTYPES = [
			"Sales Invoice",
			"Purchase Invoice",
			"Journal Entry",
			"Payment Entry",
			"Sales Order",
			"Purchase Order",
			"Stock Entry",
			"Delivery Note",
			"Purchase Receipt",
			"Quotation",
			"Material Request",
			"Payment Request",
		];

		const options = DOCTYPES.map(
			(dt) =>
				`<option value="${dt}" ${this.state.form.doctype === dt ? "selected" : ""}>${dt}</option>`
		).join("");

		return `<div class="dnc-card">
			<div class="dnc-card-header">
				<div class="dnc-card-icon blue">📄</div>
				<div>
					<div class="dnc-card-title">${__("Document Type")}</div>
					<div class="dnc-card-subtitle">${__("Which document should this rule apply to?")}</div>
				</div>
			</div>
			<div class="dnc-card-body">
				<div class="frappe-control">
					<div class="control-label">${__("DocType")} <span class="text-danger">*</span></div>
					<div class="control-input-wrapper">
						<select id="dnc-doctype" class="input-with-feedback form-control">
							<option value="">— ${__("Select DocType")} —</option>
							${options}
						</select>
					</div>
				</div>
			</div>
		</div>`;
	}

	_card_company() {
		return `<div class="dnc-card">
			<div class="dnc-card-header">
				<div class="dnc-card-icon blue">🏢</div>
				<div>
					<div class="dnc-card-title">${__("Company Configuration")}</div>
					<div class="dnc-card-subtitle">${__("Rule applies to a specific company or all companies")}</div>
				</div>
			</div>
			<div class="dnc-card-body">
				<div class="row">
					<div class="col-sm-7">
						<div class="frappe-control">
							<div class="control-label">${__("Company")} <span class="text-danger">*</span></div>
							<div class="control-input-wrapper">
								<select id="dnc-company" class="input-with-feedback form-control">
									<option value="">— ${__("Select Company")} —</option>
								</select>
							</div>
						</div>
					</div>
					<div class="col-sm-5">
						<div class="frappe-control">
							<div class="control-label">${__("Company Abbreviation")}</div>
							<div class="control-input-wrapper dnc-abbr-auto">
								<input id="dnc-abbr" type="text" maxlength="10" placeholder="${__("e.g. SNCG")}"
									class="input-with-feedback form-control"
									value="${frappe.utils.escape_html(this.state.form.company_abbr)}">
								<span class="dnc-abbr-badge" id="dnc-abbr-badge" style="display:none;">✓ ${__("Auto")}</span>
							</div>
							<p class="help-box small text-muted">${__("Auto-filled from company. You can override.")}</p>
						</div>
					</div>
				</div>
			</div>
		</div>`;
	}

	_card_fiscal_year() {
		return `<div class="dnc-card">
			<div class="dnc-card-header">
				<div class="dnc-card-icon amber">📅</div>
				<div>
					<div class="dnc-card-title">${__("Fiscal Year Configuration")}</div>
					<div class="dnc-card-subtitle">${__("Include a fiscal year code in document names")}</div>
				</div>
			</div>
			<div class="dnc-card-body">
				<div class="checkbox" style="margin-top:0;">
					<label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
						<input type="checkbox" id="dnc-use-fy" ${this.state.form.use_fiscal_year ? "checked" : ""}>
						<span style="font-size:var(--text-sm)">${__("Include fiscal year in document name")}</span>
					</label>
				</div>

				<div id="dnc-fy-options" style="${this.state.form.use_fiscal_year ? "" : "display:none;"}margin-top:14px;">
					<div class="row">
						<div class="col-sm-6">
							<div class="frappe-control">
								<div class="control-label">${__("Fiscal Year")}</div>
								<div class="control-input-wrapper">
									<select id="dnc-fy-select" class="input-with-feedback form-control">
										<option value="">— ${__("Select")} —</option>
									</select>
								</div>
							</div>
						</div>
						<div class="col-sm-6">
							<div class="frappe-control">
								<div class="control-label">${__("Format")}</div>
								<div class="control-input-wrapper">
									<select id="dnc-fy-format" class="input-with-feedback form-control">
										<option value="short">${__("25-26 (Short Range)")}</option>
										<option value="fy_short">${__("FY26 (Short Year)")}</option>
										<option value="fy_full">${__("FY2026 (Full Year)")}</option>
										<option value="full">${__("2025-2026 (Full Range)")}</option>
									</select>
								</div>
							</div>
						</div>
					</div>

					<div class="dnc-fy-preview" id="dnc-fy-preview" style="display:none;">
						<span style="color:var(--text-muted);font-size:var(--text-xs);">${__("Code in document")}:</span>
						<span class="dnc-fy-code" id="dnc-fy-code"></span>
					</div>

					<div class="dnc-alert info" style="margin-top:10px;">
						<span class="dnc-alert-icon">ℹ️</span>
						<span>${__("The fiscal year is auto-determined from the Posting Date. Creating a new rule per fiscal year resets the counter to 00001.")}</span>
					</div>
				</div>
			</div>
		</div>`;
	}

	_card_format() {
		return `<div class="dnc-card">
			<div class="dnc-card-header">
				<div class="dnc-card-icon violet">🔧</div>
				<div>
					<div class="dnc-card-title">${__("Number Format Builder")}</div>
					<div class="dnc-card-subtitle">${__("Configure prefix components and running number digits")}</div>
				</div>
			</div>
			<div class="dnc-card-body">

				<div class="dnc-section-label">${__("Prefix Components")}</div>
				<div class="dnc-components-wrap" id="dnc-comp-list">
					${this._components_html(this.state.form.prefix_components)}
				</div>
				<button class="dnc-add-comp-btn" id="dnc-add-comp">
					${frappe.utils.icon("add", "sm")} ${__("Add Prefix Component")}
				</button>

				<div class="dnc-prefix-preview" id="dnc-prefix-preview">
					<span class="text-muted" style="font-size:var(--text-xs);">${__("Generated Prefix")}:</span>
					<strong class="dnc-prefix-val" id="dnc-prefix-val">—</strong>
				</div>

				<hr style="margin:16px 0;border-color:var(--border-color);">

				<div class="dnc-section-label">${__("Running Number")}</div>
				<div class="dnc-digit-row" id="dnc-digits">
					${[3, 4, 5, 6, 7]
						.map(
							(d) => `
						<div class="dnc-digit-opt ${this.state.form.digits == d ? "active" : ""}" data-digits="${d}">
							<div class="dnc-digit-num">${d}</div>
							<div class="dnc-digit-ex">${"0".repeat(d - 1)}1</div>
						</div>`
						)
						.join("")}
				</div>
				<p class="help-box small text-muted" style="margin-top:8px;">
					${__("The counter starts at 1 for each new rule. Create a new rule per fiscal year to reset numbering annually.")}
				</p>

				<hr style="margin:16px 0;border-color:var(--border-color);">

				<div class="frappe-control" style="max-width:160px;">
					<div class="control-label">${__("Priority")}</div>
					<div class="control-input-wrapper">
						<input id="dnc-priority" type="number" min="0"
							class="input-with-feedback form-control"
							value="${this.state.form.priority}">
					</div>
					<p class="help-box small text-muted">${__("Higher number = applied first. 0 = auto.")}</p>
				</div>

			</div>
		</div>`;
	}

	// ── Component list HTML ───────────────────────────────────────────────────

	_components_html(components) {
		if (!components || !components.length) {
			return `<div class="dnc-no-components">${__("No components added yet.")}</div>`;
		}
		return components
			.map(
				(c, i) => `
			<div class="dnc-component-row" data-idx="${i}">
				<span class="dnc-drag-handle text-muted">⠿</span>
				<span class="dnc-comp-order">${i + 1}</span>
				<span class="dnc-comp-type ${c.type === "static" ? "static" : c.type === "company_abbr" ? "company" : "fiscal"}">
					${this._comp_type_label(c.type)}
				</span>
				<span class="dnc-comp-value">${frappe.utils.escape_html(c.display || c.value || "")}</span>
				<button class="btn btn-xs btn-default dnc-rm-comp"
					data-idx="${i}" title="${__("Remove")}"
					style="margin-left:auto;color:var(--red-500,#e03636);padding:2px 6px;">
					${frappe.utils.icon("close", "xs")}
				</button>
			</div>`
			)
			.join("");
	}

	_comp_type_label(type) {
		return (
			{ static: __("Static Text"), company_abbr: __("Company Abbr."), fiscal_year: __("Fiscal Year") }[
				type
			] || type
		);
	}

	// ── Preview panel ─────────────────────────────────────────────────────────

	_preview_panel() {
		return `<div class="dnc-preview-panel">
			<div class="dnc-preview-heading">📋 ${__("Live Preview")}</div>
			<div class="dnc-preview-chips" id="dnc-preview-chips"></div>
			<div class="dnc-preview-final-label">${__("Generated Document Number")}</div>
			<div class="dnc-preview-final" id="dnc-preview-final">
				<span id="dnc-seg-prefix" class="seg-prefix">—</span>
				<span class="seg-sep" id="dnc-seg-sep" style="display:none;">-</span>
				<span id="dnc-seg-num" class="seg-num"></span>
			</div>
			<div class="dnc-preview-note">
				${__("The number resets to 1 for each new rule you create.")}
			</div>
		</div>`;
	}

	_summary_card() {
		return `<div class="dnc-summary-card">
			<div class="dnc-summary-head">${__("Rule Summary")}</div>
			<div class="dnc-summary-body" id="dnc-summary"></div>
		</div>`;
	}

	// ── Form event binding ────────────────────────────────────────────────────

	_bind_form_events() {
		const self = this;

		// Back
		this.$form.find(".dnc-back").on("click", (e) => {
			e.preventDefault();
			this._show_list();
		});

		// Cancel
		this.$form.find(".dnc-cancel").on("click", () => this._show_list());

		// Save
		this.$form.find(".dnc-save").on("click", () => this._save_rule());

		// DocType
		this.$form.find("#dnc-doctype").on("change", function () {
			self.state.form.doctype = $(this).val();
			self._update_preview();
		});

		// Company
		this.$form.find("#dnc-company").on("change", function () {
			const company = $(this).val();
			self.state.form.company = company;
			if (company) {
				frappe.call({
					method: "erpnext.accounts.page.document_naming_configuration.document_naming_configuration.get_company_details",
					args: { company },
					callback: (r) => {
						const abbr = (r.message || {}).abbr || "";
						self.state.form.company_abbr = abbr;
						self.$form.find("#dnc-abbr").val(abbr);
						self.$form.find("#dnc-abbr-badge").show();
						self._sync_abbr_in_components();
						self._update_preview();
					},
				});
			} else {
				this._update_preview();
			}
		});

		// Abbreviation manual override
		this.$form.find("#dnc-abbr").on("input", function () {
			const val = $(this).val().toUpperCase().replace(/[^A-Z0-9\-]/g, "");
			$(this).val(val);
			self.$form.find("#dnc-abbr-badge").hide();
			self.state.form.company_abbr = val;
			self._sync_abbr_in_components();
			self._update_preview();
		});

		// Use fiscal year
		this.$form.find("#dnc-use-fy").on("change", function () {
			self.state.form.use_fiscal_year = $(this).is(":checked");
			self.$form.find("#dnc-fy-options").toggle(self.state.form.use_fiscal_year);
			self._update_preview();
		});

		// Fiscal year select
		this.$form.find("#dnc-fy-select").on("change", function () {
			self.state.form.fiscal_year = $(this).val();
			self._compute_fy_abbr();
			self._update_preview();
		});

		// FY format
		this.$form.find("#dnc-fy-format").on("change", function () {
			self.state.form.fiscal_year_format = $(this).val();
			self._compute_fy_abbr();
			self._update_preview();
		});

		// Add component
		this.$form.find("#dnc-add-comp").on("click", () => this._show_add_component_dialog());

		// Remove component (delegated)
		this.$form.on("click", ".dnc-rm-comp", function () {
			const idx = parseInt($(this).data("idx"), 10);
			self.state.form.prefix_components.splice(idx, 1);
			self._refresh_components();
			self._update_preview();
		});

		// Digit selector (delegated)
		this.$form.on("click", ".dnc-digit-opt", function () {
			self.$form.find(".dnc-digit-opt").removeClass("active");
			$(this).addClass("active");
			self.state.form.digits = parseInt($(this).data("digits"), 10);
			self._update_preview();
		});

		// Priority
		this.$form.find("#dnc-priority").on("change", function () {
			self.state.form.priority = parseInt($(this).val(), 10) || 0;
		});

		// Load remote data
		this._load_companies();
		this._load_fiscal_years();

		// Set saved doctype
		if (this.state.form.doctype) {
			this.$form.find("#dnc-doctype").val(this.state.form.doctype);
		}
	}

	// ── Remote data loaders ───────────────────────────────────────────────────

	_load_companies() {
		frappe.call({
			method: "erpnext.accounts.page.document_naming_configuration.document_naming_configuration.get_companies",
			callback: (r) => {
				const companies = r.message || [];
				const $sel = this.$form.find("#dnc-company");
				companies.forEach((c) => {
					$sel.append(
						`<option value="${frappe.utils.escape_html(c.name)}"
							${this.state.form.company === c.name ? "selected" : ""}>
							${frappe.utils.escape_html(c.name)}
						</option>`
					);
				});
				if (this.state.form.company && this.state.form.company_abbr) {
					this.$form.find("#dnc-abbr").val(this.state.form.company_abbr);
					this.$form.find("#dnc-abbr-badge").show();
				}
			},
		});
	}

	_load_fiscal_years() {
		frappe.call({
			method: "erpnext.accounts.page.document_naming_configuration.document_naming_configuration.get_fiscal_years",
			callback: (r) => {
				const fys = r.message || [];
				const $sel = this.$form.find("#dnc-fy-select");
				fys.forEach((fy) => {
					$sel.append(
						`<option value="${frappe.utils.escape_html(fy.name)}"
							${this.state.form.fiscal_year === fy.name ? "selected" : ""}>
							${frappe.utils.escape_html(fy.name)}
						</option>`
					);
				});
				if (this.state.form.fiscal_year) {
					this._compute_fy_abbr();
				}
			},
		});
	}

	// ── Fiscal year abbreviation ──────────────────────────────────────────────

	_compute_fy_abbr() {
		const fy = this.state.form.fiscal_year;
		const fmt = this.state.form.fiscal_year_format;

		if (!fy) {
			this.state.form.fiscal_year_abbr = "";
			this.$form.find("#dnc-fy-preview").hide();
			return;
		}

		// FY name is typically "2025-2026"
		const parts = fy.split("-").map((p) => p.trim());
		const sy = parts[0] || ""; // start year e.g. "2025"
		const ey = parts[1] || ""; // end year   e.g. "2026"

		let abbr = "";
		if (fmt === "short") abbr = `${sy.slice(-2)}-${ey.slice(-2)}`; // 25-26
		else if (fmt === "fy_short") abbr = `FY${ey.slice(-2)}`; // FY26
		else if (fmt === "fy_full") abbr = `FY${ey}`; // FY2026
		else abbr = fy; // 2025-2026

		this.state.form.fiscal_year_abbr = abbr;
		this.$form.find("#dnc-fy-code").text(abbr);
		this.$form.find("#dnc-fy-preview").show();
		this._sync_fy_in_components();
	}

	// ── Component sync helpers ────────────────────────────────────────────────

	_sync_abbr_in_components() {
		this.state.form.prefix_components.forEach((c) => {
			if (c.type === "company_abbr") {
				c.value = this.state.form.company_abbr;
				c.display = this.state.form.company_abbr || __("(set company first)");
			}
		});
		this._refresh_components();
	}

	_sync_fy_in_components() {
		this.state.form.prefix_components.forEach((c) => {
			if (c.type === "fiscal_year") {
				c.value = this.state.form.fiscal_year_abbr;
				c.display = this.state.form.fiscal_year_abbr || __("(set fiscal year first)");
			}
		});
		this._refresh_components();
	}

	_refresh_components() {
		this.$form
			.find("#dnc-comp-list")
			.html(this._components_html(this.state.form.prefix_components));
	}

	// ── Add component dialog ──────────────────────────────────────────────────

	_show_add_component_dialog() {
		const d = new frappe.ui.Dialog({
			title: __("Add Prefix Component"),
			fields: [
				{
					fieldtype: "Select",
					fieldname: "component_type",
					label: __("Component Type"),
					options: [
						{ value: "static", label: __("Static Text") },
						{ value: "company_abbr", label: __("Company Abbreviation") },
						{ value: "fiscal_year", label: __("Fiscal Year") },
					].map((o) => o.label).join("\n"),
					default: "Static Text",
					reqd: 1,
					description: __("Choose the type of component to add to the prefix."),
				},
				{
					fieldtype: "Data",
					fieldname: "static_value",
					label: __("Text Value"),
					description: __("Only letters, numbers, and hyphens (A-Z, 0-9, -). Will be uppercased."),
					depends_on: "eval:doc.component_type === 'Static Text'",
					mandatory_depends_on: "eval:doc.component_type === 'Static Text'",
				},
			],
			primary_action_label: __("Add"),
			primary_action: (values) => {
				const type_label = values.component_type;
				const type_map = {
					[__("Static Text")]: "static",
					[__("Company Abbreviation")]: "company_abbr",
					[__("Fiscal Year")]: "fiscal_year",
				};
				const type = type_map[type_label] || "static";
				let comp = { type };

				if (type === "static") {
					const val = (values.static_value || "").trim().toUpperCase();
					if (!val) {
						frappe.msgprint(__("Text value cannot be empty."));
						return;
					}
					if (!/^[A-Z0-9\-]+$/.test(val)) {
						frappe.msgprint(__("Only letters, numbers, and hyphens are allowed."));
						return;
					}
					comp.value = val;
					comp.display = val;
				} else if (type === "company_abbr") {
					const abbr = this.state.form.company_abbr || "";
					comp.value = abbr;
					comp.display = abbr || __("(set company first)");
				} else if (type === "fiscal_year") {
					const fy_abbr = this.state.form.fiscal_year_abbr || "";
					comp.value = fy_abbr;
					comp.display = fy_abbr || __("(set fiscal year first)");
				}

				this.state.form.prefix_components.push(comp);
				this._refresh_components();
				this._update_preview();
				d.hide();
			},
		});
		d.show();
	}

	// ── Live preview update ───────────────────────────────────────────────────

	_update_preview() {
		const form = this.state.form;
		const parts = (form.prefix_components || [])
			.map((c) => c.display || c.value || "")
			.filter(Boolean);
		const prefix = parts.join("-");
		const pad = "0".repeat(form.digits - 1) + "1";

		// Prefix display
		this.$form.find("#dnc-prefix-val").text(prefix || "—");

		// Chips
		const chips_html = parts
			.map(
				(p, i) => `
			${i > 0 ? '<span class="dnc-preview-sep">-</span>' : ""}
			<div class="dnc-preview-chip">
				<div class="dnc-preview-chip-label">${__("Part")} ${i + 1}</div>
				<div class="dnc-preview-chip-val">${frappe.utils.escape_html(p)}</div>
			</div>`
			)
			.join("");
		this.$form.find("#dnc-preview-chips").html(chips_html);

		// Final number
		if (prefix) {
			this.$form.find("#dnc-preview-final").html(`
				<span class="seg-prefix">${frappe.utils.escape_html(prefix)}</span>
				<span class="seg-sep">-</span>
				<span class="seg-num">${pad}</span>
			`);
		} else {
			this.$form
				.find("#dnc-preview-final")
				.html(
					`<span style="color:rgba(255,255,255,0.35)">${__("Add prefix components to see preview")}</span>`
				);
		}

		// Summary
		const rows = [
			[__("DocType"), form.doctype || "—"],
			[__("Company"), form.company || __("All Companies")],
			[__("Fiscal Year"), form.fiscal_year || __("Not set")],
			[__("Digits"), form.digits],
			[__("Priority"), form.priority || __("Auto")],
		];
		this.$form.find("#dnc-summary").html(
			rows
				.map(
					([label, val]) => `
				<div class="dnc-summary-row">
					<span class="dnc-summary-label">${label}</span>
					<span class="dnc-summary-value">${frappe.utils.escape_html(String(val))}</span>
				</div>`
				)
				.join("")
		);
	}

	// ── Save ──────────────────────────────────────────────────────────────────

	_validate_form() {
		const f = this.state.form;
		const errs = [];
		if (!f.doctype) errs.push(__("DocType is required."));
		if (!f.company) errs.push(__("Company is required."));
		if (!f.prefix_components || !f.prefix_components.length)
			errs.push(__("At least one prefix component is required."));

		if (errs.length) {
			frappe.msgprint({
				title: __("Validation Error"),
				message: errs.map((e) => `• ${e}`).join("<br>"),
				indicator: "red",
			});
			return false;
		}
		return true;
	}

	_save_rule() {
		if (!this._validate_form()) return;

		frappe.call({
			method: "erpnext.accounts.page.document_naming_configuration.document_naming_configuration.save_naming_rule",
			args: { config: JSON.stringify(this.state.form) },
			btn: this.$form.find(".dnc-save")[0],
			callback: (r) => {
				if (r.message) {
					frappe.show_alert({ message: __("Naming rule saved"), indicator: "green" });
					this._show_list();
				}
			},
		});
	}

	// ── Switch to list ────────────────────────────────────────────────────────

	_show_list() {
		this.state.view = "list";
		this.state.editing = null;
		this.$form.hide();
		this.$list.show();
		this.load_rules();
	}
}
