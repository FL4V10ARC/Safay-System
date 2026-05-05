const {confirmOrder} = require("./orders/confirmOrder");
const {cancelOrder} = require("./orders/cancelOrder");
const {updateOrderStatus} = require("./orders/updateOrderStatus");
const {getOrders} = require("./orders/getOrders");
const {getOrderById} = require("./orders/getOrderById");

exports.confirmOrder = confirmOrder;
exports.cancelOrder = cancelOrder;
exports.updateOrderStatus = updateOrderStatus;
exports.getOrders = getOrders;
exports.getOrderById = getOrderById;
