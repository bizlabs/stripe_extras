# -*- coding: utf-8 -*-

from odoo import models, fields, api
import logging
import requests
import werkzeug
TIMEOUT = 10

class stripeExtras(models.Model):
    _inherit = 'pos.payment.method'
    _description = 'add refund to stripe pos terminal'

    @api.model
    def stripe_refund (self, paymentIntentId, amount=None):
        """processes stripe refund.

        :param paymentIntentId: the id of the payment to capture (odoo transaction id)
        :param amount: without this parameter the entire order is refunded.
            Smaller amount allows partial refund.  Larger amount results in error.
        """
        if not self.env.user.has_group('point_of_sale.group_pos_user'):
            raise AccessError(_("Do not have access to fetch token from Stripe"))

        endpoint = 'refunds'

        data = {"payment_intent": paymentIntentId}
        if amount is not None:
            data = {
                "amount": amount,
                "payment_intent": paymentIntentId,
            }
        provider = self.sudo()._get_stripe_payment_provider()
        resp = provider._stripe_make_request(endpoint, data)
        return resp

