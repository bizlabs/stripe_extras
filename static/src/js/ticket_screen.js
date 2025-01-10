/** @odoo-module */

import { TicketScreen } from "@point_of_sale/app/screens/ticket_screen/ticket_screen";
import { patch } from "@web/core/utils/patch";

// export class TicketScreenStripeExtras extends TicketScreen {

patch(TicketScreen.prototype, {
    async onDoRefund() {
        const order = this.getSelectedOrder();
        if (order && this._doesOrderHaveSoleItem(order)) {
            if (!this._prepareAutoRefundOnOrder(order)) {
                // Don't proceed on refund if preparation returned false.
                return;
            }
        }

        if (!order) {
            this._state.ui.highlightHeaderNote = !this._state.ui.highlightHeaderNote;
            return;
        }

        const partner = order.get_partner();

        const allToRefundDetails = this._getRefundableDetails(partner);
        if (allToRefundDetails.length == 0) {
            this._state.ui.highlightHeaderNote = !this._state.ui.highlightHeaderNote;
            return;
        }

        const invoicedOrderIds = new Set(
            allToRefundDetails
                .filter(
                    (detail) =>
                        this._state.syncedOrders.cache[detail.orderline.orderBackendId]?.state ===
                        "invoiced"
                )
                .map((detail) => detail.orderline.orderBackendId)
        );

        if (invoicedOrderIds.size > 1) {
            this.popup.add(ErrorPopup, {
                title: _t("Multiple Invoiced Orders Selected"),
                body: _t(
                    "You have selected orderlines from multiple invoiced orders. To proceed refund, please select orderlines from the same invoiced order."
                ),
            });
            return;
        }

        // The order that will contain the refund orderlines.
        // Use the destinationOrder from props if the order to refund has the same
        // partner as the destinationOrder.
        const destinationOrder =
            this.props.destinationOrder &&
            partner === this.props.destinationOrder.get_partner() &&
            !this.pos.doNotAllowRefundAndSales()
                ? this.props.destinationOrder
                : this._getEmptyOrder(partner);

        // Add orderline for each toRefundDetail to the destinationOrder.
        const originalToDestinationLineMap = new Map();

        // First pass: add all products to the destination order
        for (const refundDetail of allToRefundDetails) {
            const product = this.pos.db.get_product_by_id(refundDetail.orderline.productId);
            const options = this._prepareRefundOrderlineOptions(refundDetail);
            const newOrderline = await destinationOrder.add_product(product, options);
            originalToDestinationLineMap.set(refundDetail.orderline.id, newOrderline);
            refundDetail.destinationOrderUid = destinationOrder.uid;
        }
        // Second pass: update combo relationships in the destination order
        for (const refundDetail of allToRefundDetails) {
            const originalOrderline = refundDetail.orderline;
            const destinationOrderline = originalToDestinationLineMap.get(originalOrderline.id);
            if (originalOrderline.comboParent) {
                const comboParentLine = originalToDestinationLineMap.get(
                    originalOrderline.comboParent.id
                );
                if (comboParentLine) {
                    destinationOrderline.comboParent = comboParentLine;
                }
            }
            if (originalOrderline.comboLines && originalOrderline.comboLines.length > 0) {
                destinationOrderline.comboLines = originalOrderline.comboLines.map((comboLine) => {
                    return originalToDestinationLineMap.get(comboLine.id);
                });
            }
        }
        //Add a check too see if the fiscal position exist in the pos
        if (order.fiscal_position_not_found) {
            this.showPopup("ErrorPopup", {
                title: _t("Fiscal Position not found"),
                body: _t(
                    "The fiscal position used in the original order is not loaded. Make sure it is loaded by adding it in the pos configuration."
                ),
            });
            return;
        }
        destinationOrder.fiscal_position = order.fiscal_position;
        // Set the partner to the destinationOrder.
        this.setPartnerToRefundOrder(partner, destinationOrder);

        if (this.pos.get_order().cid !== destinationOrder.cid) {
            this.pos.set_order(destinationOrder);
        }
        await this.addAdditionalRefundInfo(order, destinationOrder);

        // create the stripePI element in the destination order so processing the refund
        // in the next screen knows which xaction to refund if stripe is chosen by the user.
        if (order.paymentlines[0].payment_method.use_payment_terminal == "stripe") {
            destinationOrder.stripePI = order.paymentlines[0].transaction_id;
        }
        this.closeTicketScreen();
    },
});
