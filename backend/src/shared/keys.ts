export const orderPk = (orderId: string) => `ORDER#${orderId}`;
export const supplierPk = (supplierId: string) => `SUPPLIER#${supplierId}`;
export const customerPk = (customerId: string) => `CUSTOMER#${customerId}`;
export const fulfillmentSk = (supplierOrderId: string) =>
  `FULFILLMENT#${supplierOrderId}`;
export const META = "META";

export const GSI_CUSTOMER = "GSI1";
export const GSI_STATUS = "GSI2";

export const callbackRecordId = (supplierOrderId: string) =>
  `${supplierOrderId}#callback`;
