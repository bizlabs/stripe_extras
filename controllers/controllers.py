# -*- coding: utf-8 -*-
# from odoo import http


# class Stripe-extras(http.Controller):
#     @http.route('/stripe-extras/stripe-extras', auth='public')
#     def index(self, **kw):
#         return "Hello, world"

#     @http.route('/stripe-extras/stripe-extras/objects', auth='public')
#     def list(self, **kw):
#         return http.request.render('stripe-extras.listing', {
#             'root': '/stripe-extras/stripe-extras',
#             'objects': http.request.env['stripe-extras.stripe-extras'].search([]),
#         })

#     @http.route('/stripe-extras/stripe-extras/objects/<model("stripe-extras.stripe-extras"):obj>', auth='public')
#     def object(self, obj, **kw):
#         return http.request.render('stripe-extras.object', {
#             'object': obj
#         })

