import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { redirectLegacyDomain } from "./lib/legacy-domain";

const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

const domainMiddleware = createMiddleware().server(async ({ handlerType, request, next }) => {
  if (handlerType === "router") {
    const redirect = redirectLegacyDomain(request);
    if (redirect) return redirect;
  }

  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, domainMiddleware],
}));
