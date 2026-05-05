const { confirmOrder } = require("./orders/confirmOrder");
const { cancelOrder } = require("./orders/cancelOrder");
const { updateOrderStatus } = require("./orders/updateOrderStatus");

exports.confirmOrder = confirmOrder;
exports.cancelOrder = cancelOrder;
exports.updateOrderStatus = updateOrderStatus;
