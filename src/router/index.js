import { createRouter, createWebHistory } from "vue-router";
import MainLayout from "@/layouts/MainLayout.vue";
import { getCurrentUser, getInventoryCurrentUser, hasAdminAccess } from "@/services/auth.service";

const routes = [
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/Auth/LoginView.vue"),
  },
  {
    path: "/inventory-login",
    name: "InventoryLogin",
    component: () => import("@/views/Auth/InventoryLoginView.vue"),
  },

  {
    path: "/",
    component: MainLayout,
    redirect: "/dashboard",
    children: [
      // DASHBOARD
      {
        path: "dashboard",
        name: "Dashboard",
        component: () => import("@/views/Dashboard/DashboardView.vue"),
      },

      // QUOTES LIST
      {
        path: "quotes",
        name: "QuotesList",
        component: () => import("@/views/Quotes/QuotesListView.vue"),
      },
      {
        path: "quotes/flight/create",
        name: "FlightQuoteCreate",
        component: () => import("@/views/Quotes/FlightQuoteCreateView.vue"),
      },
      {
        path: "quotes/admin",
        name: "AdminQuotes",
        component: () => import("@/views/AdminQuotes.vue"),
      },

      // INVENTORY QUOTES
      {
        path: "quotes/inventory",
        name: "InventoryQuote",
        component: () => import("@/views/Quotes/inventario/InventoryQuote.vue"),
      },
      {
        path: "quotes/aviation-parts",
        name: "AviationParts",
        component: () =>
          import("@/views/Quotes/inventario/AviationPartsView.vue"),
      },
      {
        path: "quotes/inventory/create",
        name: "CreateInventoryQuote",
        component: () =>
          import("@/views/Quotes/inventario/CreateInventoryQuote.vue"),
      },
      {
        path: "quotes/inventory-pdf",
        name: "InventoryPdf",
        component: () => import("@/views/Quotes/inventario/InventoryPdf.vue"),
      },

      // QUOTE DETAIL
      {
        path: "quotes/:id(\\d+)",
        name: "QuoteDetail",
        component: () => import("@/views/Quotes/QuoteDetailView.vue"),
        props: true,
      },
    
      {
        path: "quotes/validation",
        name: "QuotesValidation",
        component: () =>
          import("@/views/Quotes/inventario/QuotesValidation.vue"),
      },
      {
        path: "quotes/follow-up",
        name: "QuotesFollowUp",
        component: () =>
          import("@/views/Quotes/inventario/SalesFollowUpView.vue"),
      },
      {
        path: "quotes/aviation-sales",
        name: "AviationSalesHub",
        component: () =>
          import("@/views/Quotes/inventario/AviationSalesHubView.vue"),
      },

      // AIRCRAFT FORM RESPONSES
      {
        path: "aircraft-forms/responses",
        name: "AircraftFormResponses",
        component: () => import("@/views/AircraftForms/AircraftFormResponsesView.vue"),
      },

      // AIRPORTS
      {
        path: "airports",
        name: "Airports",
        component: () => import("@/views/Airports/AirportsListView.vue"),
      },

      // ROUTES
      {
        path: "routes",
        name: "Routes",
        component: () => import("@/views/Routes/RoutesListView.vue"),
      },
      {
        path: "nautical-miles",
        name: "NauticalMiles",
        component: () => import("@/views/Routes/NauticalMilesView.vue"),
      },

      // BLOCKED DATES
      {
        path: "blocked-dates",
        name: "BlockedDates",
        component: () => import("@/views/BlockedDates/BlockedDatesView.vue"),
      },
      {
        path: "blocked-dates/create",
        name: "CreateBlockedDate",
        component: () =>
          import("@/views/BlockedDates/CreateBlockedDateView.vue"),
      },

      // SETTINGS
      {
        path: "settings",
        name: "Settings",
        component: () => import("@/views/Settings/SettingsView.vue"),
      },

      // AIRCRAFT
      {
        path: "aircraft",
        name: "AircraftList",
        component: () => import("@/views/Aircraft/AircraftListView.vue"),
      },
      {
        path: "lookbooks",
        name: "LookbooksAdmin",
        component: () => import("@/views/Lookbooks/LookbooksAdminView.vue"),
        meta: { requiresAdmin: true },
      },
      {
        path: "correos-masivos",
        name: "BulkEmailCampaigns",
        component: () => import("@/features/bulk-email/views/BulkEmailCampaignsView.vue"),
        meta: { requiresAdmin: true, requiresInventoryAuth: true },
      },
      {
        path: "correos-masivos/nueva",
        name: "BulkEmailCreate",
        component: () => import("@/features/bulk-email/views/BulkEmailCreateView.vue"),
        meta: { requiresAdmin: true, requiresInventoryAuth: true },
      },
      {
        path: "correos-masivos/:id",
        name: "BulkEmailDetail",
        component: () => import("@/features/bulk-email/views/BulkEmailDetailView.vue"),
        meta: { requiresAdmin: true, requiresInventoryAuth: true },
        props: true,
      },
      {
        path: "correos-masivos/:id/editar",
        name: "BulkEmailEdit",
        component: () => import("@/features/bulk-email/views/BulkEmailEditView.vue"),
        meta: { requiresAdmin: true, requiresInventoryAuth: true },
        props: true,
      },
      {
        path: "aircraft/new",
        name: "AircraftNew",
        component: () => import("@/views/Aircraft/AircraftFormView.vue"),
      },
      // {
      //   path: "aircraft/edit/:id(\\d+)",
      //   name: "AircraftEdit",
      //   component: () => import("@/views/Aircraft/AircraftFormView.vue"),
      //   props: true,
      // },
      {
        path: "aircraft/edit/:id",
        name: "AircraftEdit",
        component: () => import("@/views/Aircraft/AircraftFormView.vue"),
        props: true,
      },
      {
        path: "aircraft/:id",
        name: "AircraftDetail",
        component: () => import("@/views/Aircraft/AircraftDetailView.vue"),
        props: true,
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory("/administrador/"),
  routes,
});

router.beforeEach(async (to) => {
  if (to.path === "/inventory-login") {
    const inventoryUser = await getInventoryCurrentUser();
    if (inventoryUser) {
      const redirect = typeof to.query.redirect === "string" ? to.query.redirect : "/correos-masivos";
      return redirect;
    }
  }

  const requiresAdmin = to.matched.some((record) => record.meta?.requiresAdmin);
  const requiresInventoryAuth = to.matched.some((record) => record.meta?.requiresInventoryAuth);

  if (!requiresAdmin && !requiresInventoryAuth) {
    return true;
  }

  if (requiresAdmin) {
    const user = await getCurrentUser();
    if (!user) {
      return {
        path: "/login",
        query: { redirect: to.fullPath },
      };
    }

    if (!hasAdminAccess(user)) {
      return { path: "/" };
    }
  }

  if (requiresInventoryAuth) {
    const inventoryUser = await getInventoryCurrentUser();
    if (!inventoryUser) {
      return {
        path: "/inventory-login",
        query: { redirect: to.fullPath },
      };
    }
  }

  return true;
});
export default router;
