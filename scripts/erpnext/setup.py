"""Run on the ERPNext bench after review; never from the storefront.

bench --site ERP_SITE console
>>> import runpy
>>> runpy.run_path('/absolute/path/scripts/erpnext/setup.py', run_name='__main__')
"""
from pathlib import Path

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def data_field(name, label, fieldtype="Data", **options):
    return dict(fieldname=name, label=label, fieldtype=fieldtype,
                insert_after="amended_from", **options)


def install():
    fields = {}
    for doctype in ("Customer", "Sales Order", "Sales Invoice", "Payment Entry"):
        # Frappe creates the unique database index. Existing conflicting keys must
        # be reconciled before installation; never drop uniqueness to bypass it.
        fields[doctype] = [data_field("custom_elegancia_key", "Elegancia unique key",
                                     unique=1, read_only=1, no_copy=1)]
    for doctype in ("Customer", "Sales Order", "Sales Invoice"):
        fields[doctype] += [
            data_field("custom_elegancia_phone", "Téléphone Elegancia"),
            data_field("custom_elegancia_address", "Adresse Elegancia", "Small Text"),
            data_field("custom_elegancia_commune", "Commune Elegancia"),
            data_field("custom_elegancia_wilaya", "Wilaya Elegancia"),
        ]
    for doctype in ("Sales Order", "Sales Invoice", "Payment Entry"):
        fields[doctype].append(data_field("custom_elegancia_order_id", "Référence commande Elegancia",
                                          read_only=1, no_copy=1))
    for doctype in ("Sales Order", "Sales Invoice"):
        fields[doctype] += [
            data_field("custom_elegancia_delivery", "Livraison Elegancia", "Small Text"),
            data_field("custom_elegancia_delivery_fee", "Frais de livraison Elegancia", "Currency"),
        ]
    for doctype in ("Sales Order Item", "Sales Invoice Item"):
        fields[doctype] = [data_field("custom_elegancia_sku", "SKU Elegancia")]
    # Values intentionally empty. Fill only from verified company/store settings.
    fields["Company"] = [
        data_field("custom_elegancia_rc", "RC Elegancia"),
        data_field("custom_elegancia_nif", "NIF Elegancia"),
        data_field("custom_elegancia_nis", "NIS Elegancia"),
        data_field("custom_elegancia_ai", "AI Elegancia"),
        data_field("custom_elegancia_legal_address", "Adresse légale Elegancia", "Small Text"),
    ]
    # Customer and child doctypes have no amended_from field.
    for doctype, definitions in fields.items():
        if not frappe.get_meta(doctype).has_field("amended_from"):
            for definition in definitions:
                definition["insert_after"] = ""
    create_custom_fields(fields, update=True)
    format_path = Path(__file__).with_name("elegancia-home-invoice.html")
    values = dict(doc_type="Sales Invoice", print_format_type="Jinja", custom_format=1,
                  standard="No", disabled=0, html=format_path.read_text(encoding="utf-8"))
    if frappe.db.exists("Print Format", "Elegancia Home Invoice"):
        doc = frappe.get_doc("Print Format", "Elegancia Home Invoice")
        doc.update(values)
        doc.save()
    else:
        frappe.get_doc(dict(doctype="Print Format", name="Elegancia Home Invoice", **values)).insert()
    frappe.db.commit()
    print("Elegancia fields and print format installed. Configure legal identity, logo, accounts and Items before activation.")


if __name__ == "__main__":
    install()
