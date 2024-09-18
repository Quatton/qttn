export const site = {
  title: "qttn.dev",
  name: "Quatton",
  url: {
    protocol: import.meta.env.DEV ? "http" : "https",
    host: import.meta.env.PUBLIC_BASE_URL,
    full: `http${import.meta.env.DEV ? "" : "s"}://${import.meta.env.PUBLIC_BASE_URL}`,
  },
  catchphrase: "Your problem, others might have it too.",
};
