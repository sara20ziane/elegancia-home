import type { DeliveryMethod } from "./delivery";
export type CheckoutForm = {
  customer_name: string;
  phone: string;
  wilaya: string;
  commune: string;
  address: string;
  note: string;
  delivery_method: DeliveryMethod;
  stopdesk_id: string;
  stopdesk_name: string;
};

export const EMPTY_CHECKOUT_FORM: CheckoutForm = {
  customer_name: "",
  phone: "",
  wilaya: "",
  commune: "",
  address: "",
  note: "",
  delivery_method: "home",
  stopdesk_id: "",
  stopdesk_name: "",
};
