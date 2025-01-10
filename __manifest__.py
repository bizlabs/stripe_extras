# -*- coding: utf-8 -*-
{
    'name': "stripe_extras",

    'summary': "Add on-reader tips and refunds to stripe on POS",

    'description': """
This module adds logic to handle on-reader tips for the stripe wise pos e reader and handle stripe refunds via odoo app
    """,

    'author': "Doug Mattingly",
    'website': "https://www.maevas.com",

    # Categories can be used to filter modules in modules listing
    # Check https://github.com/odoo/odoo/blob/15.0/odoo/addons/base/data/ir_module_category_data.xml
    # for the full list
    'category': 'Sales',
    'version': '0.1',

    # any module necessary for this one to work correctly
    'depends': ['base', 'pos_stripe'],

    # always loaded
    'data': [
        # 'security/ir.model.access.csv',
        'views/views.xml',
        'views/templates.xml',
    ],
    'assets': {
        'point_of_sale._assets_pos': [
            'stripe_extras/static/src/js/*',
        ],
    },
    # only loaded in demonstration mode
    'demo': [
        'demo/demo.xml',
    ],
}

