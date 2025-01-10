/** @odoo-module */
/* global StripeTerminal */

import { PaymentStripe } from "@pos_stripe/app/payment_stripe";
import { ErrorPopup } from "@point_of_sale/app/errors/popups/error_popup";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";

// export class PaymentStripeExtras extends PaymentStripe {
patch(PaymentStripe.prototype, {
    
    // discoverReaders() function only needed for simulation.  Eliminate entire function for production as it's covered in upstream
    async discoverReaders() {
        const discoverResult = await this.terminal.discoverReaders({ simulated: true });
        if (discoverResult.error) {
            this._showError(_t("Failed to discover: %s", discoverResult.error));
        } else if (discoverResult.discoveredReaders.length === 0) {
            this._showError(_t("No available Stripe readers."));
        } else {
            // Need to stringify all Readers to avoid to put the array into a proxy Object not interpretable
            // for the Stripe SDK
            this.pos.discoveredReaders = JSON.stringify(discoverResult.discoveredReaders);
        }
    },

    //override collectPayment to add logic for refunds and tips
    async collectPayment(amount) {
        const line = this.pos.get_order().selected_paymentline;

        //use refund api if refund
        if (line.amount < 0) {
            if ('stripePI' in this.pos.get_order()) {
                const piid = this.pos.get_order().stripePI; //stripePI set from the refund screen (ticket_screen.js)
                line.amount = -line.amount // refund expects a postive amount to refund
                if (this.refundPayment(piid, line) ) {
                    line.set_payment_status("done");
                    return true;
                }
                return false;
            }
            else {
                this._showError("no Stripe payment to refund")
                return false;
            }
        }

        //simulation for testing only
        var cardno = '4242424242424242';
        var testtype = 0;
        while (testtype != 1 && testtype !=2) {
            testtype = prompt("enter 1 to test visa \n or 2 to test declined \n testtype");
        }
        // cardno = prompt("enter 1 for test visa \n  2. test decline");
        cardno = '4000000000000002';
        if (testtype == 1) {
            cardno = '4242424242424242';
        }
        var tipAmount = prompt("enter tip ");
        this.terminal.setSimulatorConfiguration({
            testCardNumber: cardno,
            tipAmount: Math.round(tipAmount*100)
        });
        
        const clientSecret = await this.fetchPaymentIntentClientSecret(line.payment_method, amount);
        if (!clientSecret) {
            line.set_payment_status("retry");
            return false;
        }

        line.set_payment_status("waitingCard");
        const collectPaymentMethod = await this.terminal.collectPaymentMethod(clientSecret);
        if (collectPaymentMethod.error) {
            this._showError(collectPaymentMethod.error.message, collectPaymentMethod.error.code);
            line.set_payment_status("retry");
            return false;
        } else {
            line.set_payment_status("waitingCapture");
            const processPayment = await this.terminal.processPayment(
                collectPaymentMethod.paymentIntent
            );
            line.transaction_id = collectPaymentMethod.paymentIntent.id;
            if (processPayment.error) {
                this._showError(processPayment.error.message, processPayment.error.code);
                line.set_payment_status("retry");
                return false;
            } else if (processPayment.paymentIntent) {
                line.set_payment_status("waitingCapture");

                const [captured_card_type, captured_transaction_id] = this._getCapturedCardAndTransactionId(processPayment);
                if (captured_card_type && captured_transaction_id) {
                    line.card_type = captured_card_type;
                    line.transaction_id = captured_transaction_id;
                } else {
                    await this.captureAfterPayment(processPayment, line);
                }
                
                // get tips from reader
                var order = this.pos.get_order();
                const tip_amount = processPayment.paymentIntent.amount_details.tip.amount;
                const amount = processPayment.paymentIntent.amount;
                if (tip_amount > 0) {
                    order.set_tip(this.stripeToCurrency(tip_amount));
                    line.set_amount(this.stripeToCurrency(amount));
                }

                line.set_payment_status("done");
                return true;
            }
        }
    },

    async refundPayment(paymentIntentId, line) {
        var amount = this.CurrencyToStripe(line.amount)
        try {
            const data = await this.env.services.orm.silent.call(
                "pos.payment.method",
                "stripe_refund",
                [[paymentIntentId], amount]
            );
            if (data.error) {
                line.amount = -line.amount;
                line.set_payment_status("retry");
                throw data.error;
                return false;
            }
            return data;
        } catch (error) {
            line.amount = -line.amount;
            line.set_payment_status("retry");
            const message = error.code === 200 ? error.data.message : error.message;
            this._showError(message, 'Refund Payment');
            return false;
        }
    },
    
    // stripe uses integers for values.  for USD, divide by 100. 
    stripeToCurrency(stripeInt) {
        return Math.round(stripeInt)/100;
    },
    CurrencyToStripe(currency) {
        return Math.round(currency*100);
    },
});