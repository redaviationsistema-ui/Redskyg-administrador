<script setup>
import { useRouter, useRoute } from "vue-router";
import { ref, onMounted, computed, watch } from "vue";
import { supabaseInventory } from "../../../supabase";
import { useFeedback } from "../../../composables/useFeedback";

const router = useRouter();
const feedback = useFeedback();

const inventory = ref([]);
const aircraftList = ref([]);

const selectedAircraft = ref("");
const selectedDescription = ref("");
const selectedPart = ref("");
const selectedItem = ref(null);
const selectedCondition = ref("");
const partSearch = ref("");

const qty = ref(1);
const unitPrice = ref(0);
const um = ref("EA");
const delivery = ref("STK");
const quoteNumber = ref("");
const items = ref([]);
const route = useRoute();
const savingQuote = ref(false);
const savingLineItems = ref(false);

const isEdit = route.query.edit === "true";
const quoteNumberParam = route.query.quote_number;

function goBack() {
  router.back();
}

function normalizeCoreValue(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || "N/A";
}

function parseCurrencyInput(value) {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");

  if (!cleaned) return 0;

  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatCurrency(value) {
  const numericValue = Number(value ?? 0);

  return numericValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeCd(value) {
  return String(value ?? "").trim().toUpperCase();
}

function hasRealCoreValue(value) {
  const trimmed = String(value ?? "").trim();
  return Boolean(trimmed) && trimmed.toUpperCase() !== "N/A";
}

function isExCondition(value) {
  return normalizeCd(value).includes("EX");
}

function getConditionOptions(item) {
  if (!item) return [];

  const options = [];

  if (hasRealCoreValue(item.or_value)) {
    options.push("SV OR");
  }

  if (hasRealCoreValue(item.ex_value)) {
    options.push("SV EX");
  }

  if (!options.length && normalizeCd(item.cd)) {
    options.push(normalizeCd(item.cd));
  }

  return options;
}

function getPreferredCondition(item) {
  const options = getConditionOptions(item);
  if (!options.length) return "";

  const normalizedCd = normalizeCd(item?.cd);
  if (normalizedCd && options.includes(normalizedCd)) {
    return normalizedCd;
  }

  return options[0];
}

function getCoreValueByCondition(item, cdOverride = item.cd) {
  if (!isExCondition(cdOverride)) {
    return "N/A";
  }

  const preferredValue = isExCondition(cdOverride) ? item.ex_value : item.or_value;

  if (hasRealCoreValue(preferredValue)) {
    return String(preferredValue).trim();
  }

  const fallbackValue = item.core_value;
  return hasRealCoreValue(fallbackValue) ? String(fallbackValue).trim() : "N/A";
}

function hasNumericValue(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;

  return !Number.isNaN(Number(trimmed));
}

function getUnitPriceByCondition(item, cdOverride = item.cd) {
  const preferredValue = isExCondition(cdOverride) ? item.ex_value : item.or_value;

  if (hasNumericValue(preferredValue)) {
    return Number(preferredValue);
  }

  return Number(item.price ?? item.unitPrice ?? 0) || 0;
}

function applyCoreValueRules(item, options = {}) {
  const {
    preserveManualCoreValue = false,
    preserveManualUnitPrice = false,
  } = options;
  const hasExValue = hasRealCoreValue(item.ex_value);
  const hasOrValue = hasRealCoreValue(item.or_value);
  const normalizedCd = normalizeCd(item.cd);
  let nextCd = normalizedCd;

  if (!nextCd) {
    nextCd = hasExValue ? "SV EX" : "SV OR";
  } else if (isExCondition(nextCd) && !hasExValue && hasOrValue) {
    nextCd = "SV OR";
  } else if (!isExCondition(nextCd) && !hasOrValue && hasExValue) {
    nextCd = "SV EX";
  }

  const resolvedCoreValue = getCoreValueByCondition(item, nextCd);
  const resolvedUnitPrice = getUnitPriceByCondition(item, nextCd);
  const currentCoreValue = String(item.core_value ?? "").trim();
  const currentUnitPriceRaw = item.unitPrice;
  const currentUnitPrice = Number(currentUnitPriceRaw ?? 0);
  const shouldPreserveManualValue =
    preserveManualCoreValue &&
    currentCoreValue !== "" &&
    currentCoreValue !== resolvedCoreValue;
  const shouldPreserveManualUnitPrice =
    preserveManualUnitPrice &&
    hasNumericValue(currentUnitPriceRaw) &&
    currentUnitPrice !== resolvedUnitPrice;

  return {
    ...item,
    cd: nextCd,
    core_value: shouldPreserveManualValue ? currentCoreValue : resolvedCoreValue,
    unitPrice: shouldPreserveManualUnitPrice
      ? currentUnitPrice
      : resolvedUnitPrice,
  };
}

function normalizeQuoteItem(item) {
  return applyCoreValueRules({
    ...item,
    qty: Number(item.qty ?? 0) || 1,
    unitPrice: Number(item.unitPrice ?? item.unit_price ?? 0) || 0,
    cd: normalizeCd(item.cd),
    core_value: item.core_value,
  }, {
    preserveManualCoreValue: true,
    preserveManualUnitPrice: true,
  });
}

function buildInventoryUpdatePayload(item) {
  return {
    ConditionCode: normalizeCd(item.cd) || null,
    PRICE: Number(item.unitPrice ?? item.unit_price ?? 0) || null,
  };
}

async function updateInventoryPartFromItem(item) {
  const payload = buildInventoryUpdatePayload(item);
  const inventoryId = item.inventory_id ?? item.inventoryId ?? null;
  let query = supabaseInventory.from("aviation_parts").update(payload);

  if (inventoryId !== null && inventoryId !== undefined) {
    query = query.eq("id", inventoryId);
  } else {
    query = query
      .eq("PartNumber", item.part_number || "")
      .eq("codigofolio", item.code || "")
      .eq("AircraftType", item.aircraft || "");
  }

  const { error } = await query;

  if (error) {
    throw error;
  }
}

async function saveEditedItems() {
  if (!isEdit || !quoteNumberParam || savingLineItems.value) return;

  savingLineItems.value = true;

  try {
    const normalizedItems = items.value.map((item) => normalizeQuoteItem(item));
    const codes = [...new Set(normalizedItems.map((item) => item.code))];
    const code = codes.length === 1 ? codes[0] : "MIXT";

    items.value = normalizedItems;

    await Promise.all(
      normalizedItems.map((item) => updateInventoryPartFromItem(item)),
    );

    const { error } = await supabaseInventory
      .from("quotes")
      .update({
        items: normalizedItems,
        customer_code: code,
      })
      .eq("quote_number", quoteNumberParam);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error(error);
    await feedback.error(
      "Unable to save changes",
      error,
      "The edited quote line could not be saved.",
    );
  } finally {
    savingLineItems.value = false;
  }
}

async function updateItemCondition(item) {
  Object.assign(item, applyCoreValueRules({
    ...item,
    cd: normalizeCd(item.cd),
  }));

  await saveEditedItems();
}

function handleItemCdInput(item) {
  Object.assign(item, applyCoreValueRules({
    ...item,
    cd: normalizeCd(item.cd),
  }));
}

async function updateItemValue(item) {
  Object.assign(item, normalizeQuoteItem(item));
  await saveEditedItems();
}

// BILL TO
const billTo = ref({
  company: "",
  street: "",
  number: "",
  city: "",
  postal: "",
  country: "",
});

// SHIP TO
const shipTo = ref({
  company: "",
  street: "",
  number: "",
  city: "",
  postal: "",
  country: "",
});

// FINAL DESTINATION
const finalDestination = ref({
  company: "",
  street: "",
  number: "",
  city: "",
  postal: "",
  country: "",
});

const sameAddress = ref(true);

// BILL → SHIP + FINAL
watch(
  billTo,
  (val) => {
    shipTo.value = { ...val };
    finalDestination.value = { ...val };
  },
  { deep: true },
);

// SHIP → FINAL
watch(
  shipTo,
  (val) => {
    finalDestination.value = { ...val };
  },
  { deep: true },
);

watch(partSearch, (value) => {
  const part = value?.trim();

  const found = inventory.value.find((item) => item.part_number === part);

  if (found) {
    const nextCondition = getPreferredCondition(found);
    selectedCondition.value = nextCondition;
    selectedItem.value = applyCoreValueRules({
      ...found,
      cd: nextCondition || found.cd,
    });
    unitPrice.value = selectedItem.value.unitPrice;
    um.value = found.uom || "EA";
  } else {
    selectedItem.value = null;
    selectedCondition.value = "";
    unitPrice.value = 0;
  }
});

watch(selectedCondition, (value) => {
  if (!selectedItem.value || !value) return;

  selectedItem.value = applyCoreValueRules({
    ...selectedItem.value,
    cd: value,
  });
  unitPrice.value = selectedItem.value.unitPrice;
});

// function addItem() {

//   if (!selectedItem.value) return

//   items.value.push({
//     part_number: selectedItem.value.part_number,
//     description: selectedItem.value.description,
//     cd: selectedItem.value.cd,
//     // items: JSON.stringify(items.value),
//     aircraft: selectedItem.value.aircraft,
//     code: selectedItem.value.code,   // 👈 IMPORTANTE
//     qty: 1,
//     um: selectedItem.value.uom || "EA",
//     delivery: "STK",
//     unitPrice: Number(selectedItem.value.price) || 0
//   })

//   // limpiar selección
//   partSearch.value = ""
//   selectedItem.value = null

// }

function addItem() {
  if (!selectedItem.value) return;

  const exists = items.value.find(
    (p) => p.part_number === selectedItem.value.part_number,
  );

  if (exists) {
    feedback.notify("This part is already added", "info");
    return;
  }

  items.value.push(applyCoreValueRules({
    inventory_id: selectedItem.value.id,
    part_number: selectedItem.value.part_number,
    description: selectedItem.value.description,
    cd: selectedCondition.value || selectedItem.value.cd,
    aircraft: selectedItem.value.aircraft,
    code: selectedItem.value.code,
    or_value: selectedItem.value.or_value,
    ex_value: selectedItem.value.ex_value,
    core_value: normalizeCoreValue(selectedItem.value.core_value),
    cert_type: selectedItem.value.cert_type || "CofC",
    qty: 1,
    um: selectedItem.value.uom || "EA",
    delivery: "STK",
    unitPrice: getUnitPriceByCondition(
      selectedItem.value,
      selectedCondition.value || selectedItem.value.cd,
    ),
  }));

  partSearch.value = "";
  selectedItem.value = null;
  selectedCondition.value = "";
}
// 
async function appendPartFromQuery() {
  const requestedPartNumber =
    typeof route.query.part_number === "string"
      ? route.query.part_number.trim()
      : "";

  if (!requestedPartNumber) return;

  const foundPart = inventory.value.find(
    (item) => item.part_number === requestedPartNumber,
  );

  if (!foundPart) {
    feedback.notify("Part not found in inventory", "warning");
  } else {
    partSearch.value = foundPart.part_number;
    addItem();
  }

  const nextQuery = { ...route.query };
  delete nextQuery.part_number;
  await router.replace({ query: nextQuery });
}

async function loadQuoteForEdit() {
  if (!quoteNumberParam) return;

  const { data, error } = await supabaseInventory
    .from("quotes")
    .select("*")
    .eq("quote_number", quoteNumberParam)
    .single();

  if (error) {
    console.error(error);
    await feedback.error(
      "Unable to load quote",
      error,
      "The quote data could not be loaded.",
    );
    return;
  }

  // 🔥 CARGAR TODO
  items.value = (data.items || []).map((item) =>
    normalizeQuoteItem({
      ...item,
      inventory_id: item.inventory_id ?? item.inventoryId ?? item.id,
      cd: item.cd ?? item.CD ?? "",
      cert_type: item.cert_type || item.certType || "CofC",
      or_value: item.or_value ?? item.orValue ?? item.or ?? item.OR,
      ex_value: item.ex_value ?? item.exValue ?? item.ex ?? item.EX,
      core_value: item.core_value ?? item.coreValue ?? item["CORE VALUE"] ?? item.CORE_VALUE,
    }),
  );
  client.value.contact = data.client_contact || "";
  client.value.phone = data.client_phone || "";
  client.value.fax = data.client_fax || "";
  client.value.email = data.client_email || "";
  client.value.exw = data.client_exw || "";
  client.value.yourRef = data.client_ref || "";

  // BILL
  billTo.value = data.bill_to || billTo.value;

  // SHIP
  shipTo.value = data.ship_to || shipTo.value;

  // FINAL
  finalDestination.value = data.final_destination || finalDestination.value;

  // SALES
  sales.value = data.sales_info || sales.value;

  // QUOTE NUMBER
  quoteNumber.value = data.quote_number;
}

async function removeItem(index) {
  const result = await feedback.confirm({
    title: "Remove part from quote?",
    text: "This item will be removed from the current quote.",
    confirmButtonText: "Remove part",
    cancelButtonText: "Keep item",
    icon: "warning",
    confirmButtonColor: "#dc2626",
  });

  if (!result.isConfirmed) return;

  items.value.splice(index, 1);
  feedback.notify("Part removed", "success");
}
watch(
  billTo,
  (val) => {
    toUpper(val);
  },
  { deep: true },
);

watch(
  shipTo,
  (val) => {
    toUpper(val);
  },
  { deep: true },
);

watch(
  finalDestination,
  (val) => {
    toUpper(val);
  },
  { deep: true },
);

// CLIENT
const client = ref({
  contact: "",
  phone: "",
  fax: "",
  email: "",
  exw: "",
  yourRef: "",
});

watch(
  client,
  (val) => {
    toUpper(val);
  },
  { deep: true },
);

// watch(selectedItem, async (item) => {
//   if (item) {
//     await getNextQuoteNumber();
//   }
// });

watch(
  items,
  async () => {
    await getNextQuoteNumber();
  },
  { deep: true },
);

// SALES
const sales = ref({
  salesPerson: "Alejandro R.",
  email: "sales@redskyg.com",
  terms: "PREPAID",
  validUntil: "",
});

// fecha válida
const today = new Date();
const validDate = new Date();
validDate.setDate(today.getDate() + 29);

sales.value.validUntil = validDate.toISOString().split("T")[0];

const loadInventory = async () => {
  const { data, error } = await supabaseInventory
    .from("aviation_parts")
    .select("*")
    .range(0, 4999);

  if (error) {
    console.error(error);
    return;
  }

  inventory.value = data.map((i) =>
    applyCoreValueRules({
      part_number: i.PartNumber ?? i.partnumber ?? i.PARTNUMBER,
      id: i.id,
      description: i.Description ?? i.description ?? i.DESCRIPTION,
      cd: i.ConditionCode ?? i.conditioncode ?? i.CONDITIONCODE,
      qty: i.Quantity ?? i.quantity ?? i.QUANTITY,
      uom: i.UoM ?? i.uom ?? i.UOM,
      aircraft: i.AircraftType ?? i.aircrafttype ?? i.AIRCRAFTTYPE,
      or_value: i.or ?? i.OR,
      ex_value: i.ex ?? i.EX,
      core_value: i["CORE VALUE"] ?? i.core_value ?? i.CORE_VALUE,
      cert_type: i["CERT TYPE"] ?? i.cert_type ?? i.CERT_TYPE ?? i.CERTTYPE ?? "CofC",
      code: i.codigofolio ?? i.CODIGOFOLIO ?? "MIXT",
      price: i.PRICE ?? i.unitprice ?? i.price,
    }),
  );
};

onMounted(async () => {
  await loadInventory();

  if (isEdit) {
    await loadQuoteForEdit();
  }

  await appendPartFromQuery();
});

// aircraft parts
const aircraftParts = computed(() => {
  if (!selectedAircraft.value) return [];

  return inventory.value.filter(
    (item) => item.aircraft === selectedAircraft.value,
  );
});

// descriptions
const descriptions = computed(() => {
  return [...new Set(aircraftParts.value.map((i) => i.description))];
});

// filtered parts
const filteredParts = computed(() => {
  if (!selectedDescription.value) return [];

  return aircraftParts.value.filter(
    (item) => item.description === selectedDescription.value,
  );
});

const quoteTotal = computed(() => {
  return items.value.reduce((sum, item) => {
    const qty = Number(item.qty ?? 0);
    const unitPrice = Number(item.unitPrice ?? 0);
    return sum + qty * unitPrice;
  }, 0);
});

// seleccionar parte
const selectPart = () => {
  selectedItem.value = filteredParts.value.find(
    (i) => i.part_number === selectedPart.value,
  );
};

async function getOrCreateCustomer() {
  const { data, error } = await supabaseInventory
    .from("customers")
    .upsert(
      {
        contact: client.value.contact,
        phone: client.value.phone,
        fax: client.value.fax,
        email: client.value.email,
        exw: client.value.exw,
        your_ref: client.value.yourRef,
      },
      {
        onConflict: "email",
      },
    )
    .select()
    .single();

  if (error) {
    console.error(error);
  }

  return data;
}
//
// COMPANY ADDRESS
//

async function getOrCreateCompany() {
  const { data: existing } = await supabaseInventory
    .from("company_address")
    .select("*")
    .eq("company", billTo.value.company)
    .single();

  if (existing) return existing;

  const { data } = await supabaseInventory
    .from("company_address")
    .insert({
      company: billTo.value.company,
      street: billTo.value.street,
      number: billTo.value.number,
      city_state: billTo.value.city,
      postal_code: billTo.value.postal,
      country: billTo.value.country,
    })
    .select()
    .single();

  return data;
}

//
// CREATE QUOTE
//

// async function createQuote(customerId) {
//   const { data, error } = await supabaseInventory
//     .from("quotes")
//     .insert({
//       quote_number: quoteNumber.value,
//       customer_id: customerId,
//       // customer_code: selectedItem.value.code,
//       customer_code: selectedItem.value?.code || "MIXT",
//     })
//     .select()
//     .single();

//   if (error) {
//     console.error(error);
//     return null;
//   }

//   return data;
// }

async function createQuote(customerId) {
  if (items.value.length === 0) return;

  const normalizedItems = items.value.map((item) => normalizeQuoteItem(item));

  const codes = [...new Set(normalizedItems.map((i) => i.code))];

  let code = codes.length === 1 ? codes[0] : "MIXT";

  const { data, error } = await supabaseInventory
    .from("quotes")
    .insert({
      quote_number: quoteNumber.value,
      customer_id: customerId,
      customer_code: code,
      items: normalizedItems,
      client_contact: client.value.contact,
      client_phone: client.value.phone,
      client_fax: client.value.fax,
      client_email: client.value.email,
      client_exw: client.value.exw,
      client_ref: client.value.yourRef,
      status: "PENDING",

      // 🔥 AGREGA ESTO
      bill_to: billTo.value,
      ship_to: shipTo.value,
      final_destination: finalDestination.value,
      sales_info: sales.value,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}
async function loadCustomer() {
  if (!client.value.contact) return;

  const { data } = await supabaseInventory
    .from("customers")
    .select("*")
    .eq("contact", client.value.contact)
    // .eq("email", client.value.email)
    .maybeSingle();

  if (data) {
    client.value.contact = data.contact;
    client.value.phone = data.phone;
    client.value.fax = data.fax;
    client.value.email = data.email;
    client.value.exw = data.exw;
    client.value.yourRef = data.your_ref;
  }
}

async function loadCompany() {
  // if (!billTo.value.company) {
  //   clearCompany();
  //   return;
  // }
  const companyName = billTo.value.company.trim();

  if (companyName.length < 11) {
    clearCompany();
    return;
  }

  const { data, error } = await supabaseInventory
    .from("company_address")
    .select("*")
    .ilike("company", `%${billTo.value.company}%`)
    .limit(1);

  if (error) {
    console.error(error);
    return;
  }

  if (data && data.length > 0) {
    const company = data[0];

    billTo.value.street = company.street;
    billTo.value.number = company.number;
    billTo.value.city = company.city_state;
    billTo.value.postal = company.postal_code;
    billTo.value.country = company.country;
  } else {
    clearCompany();
  }
}

function clearCompany() {
  billTo.value.street = "";
  billTo.value.number = "";
  billTo.value.city = "";
  billTo.value.postal = "";
  billTo.value.country = "";
}

async function getNextQuoteNumber() {
  if (items.value.length === 0) return;

  // obtener códigos únicos de las piezas
  const codes = [...new Set(items.value.map((i) => i.code))];

  let code = "";

  if (codes.length === 1) {
    code = codes[0]; // AW o LJ
  } else {
    code = "MIXT"; // diferentes aeronaves
  }

  const year = new Date().getFullYear().toString().slice(-2);

  const prefix = `QT${year}${code}`;

  const { data, error } = await supabaseInventory
    .from("quotes")
    .select("quote_number")
    .ilike("quote_number", `${prefix}%`)
    .order("quote_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    return;
  }

  let nextNumber = "001";

  if (data && data.quote_number) {
    const lastNumber = parseInt(data.quote_number.slice(-3)) || 0;
    nextNumber = String(lastNumber + 1).padStart(3, "0");
  }

  quoteNumber.value = `${prefix}${nextNumber}`;
}
// --------------------------------SAVE----------------------------------------

async function saveAddress(address) {
  if (!address.company) return;

  const company = address.company.trim();
  const street = address.street || "";

  // 1️⃣ buscar si ya existe
  const { data: existing, error: searchError } = await supabaseInventory
    .from("company_address")
    .select("*")
    .eq("company", company)
    .eq("street", street)
    .limit(1);

  if (searchError) {
    console.error(searchError);
    return;
  }

  // 2️⃣ si existe → devolver
  if (existing && existing.length > 0) {
    return existing[0];
  }

  // 3️⃣ intentar insertar
  const { data, error } = await supabaseInventory
    .from("company_address")
    .insert({
      company: company,
      street: street,
      number: address.number || "",
      city_state: address.city || "",
      postal_code: address.postal || "",
      country: address.country || "",
    })
    .select()
    .single();

  // 4️⃣ si hubo conflicto → volver a buscar
  if (error && error.code === "23505") {
    const { data: retry } = await supabaseInventory
      .from("company_address")
      .select("*")
      .eq("company", company)
      .eq("street", street)
      .single();

    return retry;
  }

  if (error) {
    console.error(error);
  }

  return data;
}

function toUpper(obj) {
  Object.keys(obj).forEach((key) => {
    // NO convertir email
    if (key === "email") return;

    if (typeof obj[key] === "string") {
      obj[key] = obj[key].toUpperCase();
    }
  });
}
//
// GENERATE PDF
//

const generatePDF = async () => {
  if (items.value.length === 0) {
    await feedback.warning(
      "No parts added",
      "Please add at least one part number before generating the quote.",
    );
    return;
  }

  savingQuote.value = true;

  try {
    items.value = items.value.map((item) => normalizeQuoteItem(item));

    // 1 CLIENT
    const customer = await getOrCreateCustomer();

  // 2 COMPANY
  await Promise.all([
    saveAddress(billTo.value),
    saveAddress(shipTo.value),
    saveAddress(finalDestination.value),
  ]);

  // 3 QUOTE

  // const quote = await createQuote(customer.id);
  let quote;
  if (isEdit) {
    const customer = await getOrCreateCustomer();

    const codes = [...new Set(items.value.map((i) => i.code))];
    const code = codes.length === 1 ? codes[0] : "MIXT";

    const { data, error } = await supabaseInventory
      .from("quotes")
      .update({
        items: items.value,
        bill_to: billTo.value,
        ship_to: shipTo.value,
        final_destination: finalDestination.value,
        sales_info: sales.value,
        client_email: client.value.email,
        client_contact: client.value.contact,
        client_phone: client.value.phone,
        client_fax: client.value.fax,
        client_exw: client.value.exw,
        client_ref: client.value.yourRef,

        // 🔥 AGREGA ESTO
        customer_id: customer.id,
        customer_code: code,
      })
      .eq("quote_number", quoteNumberParam)
      .select()
      .single();

    if (error) {
      throw error;
    }

    quote = data;
  } else {
    quote = await createQuote(customer.id);
  }

  if (!quote) {
    throw new Error("The quote could not be generated.");
  }

  quoteNumber.value = quote.quote_number;
  feedback.notify(
    isEdit ? "Quote updated successfully" : "Quote created successfully",
    "success",
  );

  router.push({
    name: "InventoryPdf",
    query: {
      quote_number: quote.quote_number,
      preview: "true",
    },
  });

  } catch (error) {
    console.error(error);
    await feedback.error(
      isEdit ? "Unable to update quote" : "Unable to create quote",
      error,
      "Please review the quote information and try again.",
    );
  } finally {
    savingQuote.value = false;
  }
};
</script>

<template>
  <div class="page">
    <div class="page-top">
      <div>
        <p class="eyebrow">Inventory Quotes</p>
        <h1>{{ isEdit ? "Edit Inventory Quote" : "Create Inventory Quote" }}</h1>
        <p class="page-subtitle">
          Capture customer data, add parts and prepare the quote before sending it to validation.
        </p>
      </div>

      <div class="quote-header">
        <h2>Quote</h2>
        <p class="quote-number">
          <strong>Quote #:</strong> {{ quoteNumber || "Generating..." }}
        </p>
        <p class="quote-meta">
          <strong>Items:</strong> {{ items.length }}
        </p>
        <p class="quote-meta">
          <strong>Total:</strong> ${{ formatCurrency(quoteTotal) }}
        </p>
      </div>
    </div>

    <div class="mobile-toolbar">
      <button type="button" class="secondary-btn" @click="goBack">
        Regresar
      </button>
      <div class="mobile-toolbar-summary">
        <span>{{ items.length }} item(s)</span>
        <strong>${{ formatCurrency(quoteTotal) }}</strong>
      </div>
    </div>

    <!-- ADDRESS GRID -->
    <p class="section-label">Addresses</p>

    <div class="address-grid">
      <!-- BILL TO -->

      <div class="address-box">
        <h3>Bill To</h3>

        <!-- <input v-model="billTo.company" placeholder="Company" /> -->
        <input
          v-model="billTo.company"
          @blur="loadCompany"
          placeholder="Company"
        />

        <input v-model="billTo.street" placeholder="Street" />

        <input v-model="billTo.number" placeholder="Number" />

        <input v-model="billTo.city" placeholder="City / State" />

        <input v-model="billTo.postal" placeholder="Postal Code" />

        <input v-model="billTo.country" placeholder="Country" />
      </div>

      <!-- SHIP TO -->

      <div class="address-box">
        <h3>Ship To</h3>

        <input v-model="shipTo.company" placeholder="Company" />

        <input v-model="shipTo.street" placeholder="Street" />

        <input v-model="shipTo.number" placeholder="Number" />

        <input v-model="shipTo.city" placeholder="City / State" />

        <input v-model="shipTo.postal" placeholder="Postal Code" />

        <input v-model="shipTo.country" placeholder="Country" />
      </div>

      <!-- FINAL DESTINATION -->

      <div class="address-box">
        <h3>Final Destination</h3>

        <input v-model="finalDestination.company" placeholder="Company" />

        <input v-model="finalDestination.street" placeholder="Street" />

        <input v-model="finalDestination.number" placeholder="Number" />

        <input v-model="finalDestination.city" placeholder="City / State" />

        <input v-model="finalDestination.postal" placeholder="Postal Code" />

        <input v-model="finalDestination.country" placeholder="Country" />
      </div>
    </div>

    <!-- CLIENT DATA -->
    <p class="section-label">Contacts</p>

    <div class="info-grid">
      <div class="info-box">
        <h3>Client Information</h3>

        <label>Contact</label>

        <input
          v-model="client.contact"
          @blur="loadCustomer"
          placeholder="Full Name"
        />

        <label>Phone</label>
        <input v-model="client.phone" placeholder="Phone Number" />

        <label>Fax</label>
        <input v-model="client.fax" placeholder="Fax" />

        <label>Email</label>
        <input v-model="client.email" placeholder="Email" />

        <label>EXW</label>
        <input v-model="client.exw" placeholder="Location" />

        <label>Your Ref #</label>
        <input v-model="client.yourRef" placeholder="Quote Reference" />
      </div>

      <div class="info-box">
        <h3>Our Information</h3>

        <label>Sales Person</label>
        <input v-model="sales.salesPerson" placeholder="Sales Person" />

        <label>Email</label>
        <input v-model="sales.email" placeholder="Email" />

        <label>Terms</label>
        <input v-model="sales.terms" />

        <label>Valid Until</label>
        <input v-model="sales.validUntil" type="date" />
      </div>
    </div>

    <!-- INVENTORY FORM -->
    <p class="section-label">Parts</p>
    <form class="form" @submit.prevent="addItem">
      <div class="part-card">
        <div class="part-card-header">
          <div>
            <h3>Add Parts</h3>
            <p>Search a part number and add it to the current quote.</p>
          </div>
          <button type="submit" class="create-btn add-btn">
            Add Part
          </button>
        </div>

        <div class="part-grid">
          <div class="field-block field-part">
            <label>Part Number</label>
            <input
              v-model="partSearch"
              placeholder="Search Part Number..."
              list="partList"
            />
          </div>

          <div class="field-block" v-if="selectedItem">
            <label>Aircraft</label>
            <input v-model="selectedItem.aircraft" readonly />
          </div>

          <div class="field-block field-description" v-if="selectedItem">
            <label>Description</label>
            <input v-model="selectedItem.description" readonly />
          </div>

          <div class="field-block" v-if="selectedItem">
            <label>Condition</label>
            <select
              v-if="getConditionOptions(selectedItem).length > 1"
              v-model="selectedCondition"
            >
              <option
                v-for="option in getConditionOptions(selectedItem)"
                :key="option"
                :value="option"
              >
                {{ option }}
              </option>
            </select>
            <input
              v-else
              :value="selectedCondition || selectedItem.cd"
              readonly
            />
          </div>

          <div class="field-block" v-if="selectedItem">
            <label>Core Value</label>
            <input
              v-model="selectedItem.core_value"
              placeholder="N/A"
              @blur="selectedItem.core_value = normalizeCoreValue(selectedItem.core_value)"
            />
          </div>
        </div>
      </div>

      <datalist id="partList">
        <option
          v-for="item in inventory"
          :key="item.part_number"
          :value="item.part_number"
        >
          {{ item.part_number }}
        </option>
      </datalist>

      <!-- QUOTE TABLE -->

      <!-- <div v-if="selectedItem" class="quote-table"> -->
      <div v-if="items.length" class="quote-table">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>CODIGO</th>

              <th>Part Number / Description</th>

              <th class="col-cd">CD</th>

              <th>Qty</th>

              <th>UM</th>

              <th>Delivery</th>

              <th>Core Value</th>

              <th>Cert Type</th>

              <th>Unit Price</th>

              <th>Line Total</th>
              <th>Remove</th>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(item, index) in items" :key="index">
              <td data-label="Item">{{ index + 1 }}</td>
              <td data-label="Codigo">{{ item.code }}</td>

              <td class="description" data-label="Part Number / Description">
                <div><strong>PART NUMBER:</strong> {{ item.part_number }}</div>

                <div><strong>DESCRIPTION:</strong> {{ item.description }}</div>
              </td>

              <td class="cell-cd" data-label="CD">
                <input
                  class="cd-control"
                  v-model="item.cd"
                  :list="`conditionOptions-${index}`"
                  placeholder="CD"
                  @input="handleItemCdInput(item)"
                  @change="updateItemCondition(item)"
                  @blur="updateItemCondition(item)"
                />
                <datalist :id="`conditionOptions-${index}`">
                  <option
                    v-for="option in getConditionOptions(item)"
                    :key="option"
                    :value="option"
                  />
                </datalist>
              </td>

              <td data-label="Qty">
                <input
                  type="number"
                  v-model.number="item.qty"
                  min="1"
                  @blur="updateItemValue(item)"
                />
              </td>

              <td data-label="UM">
                <input v-model="item.um" @blur="updateItemValue(item)" />
              </td>

              <td data-label="Delivery">
                <input v-model="item.delivery" @blur="updateItemValue(item)" />
              </td>

              <td data-label="Core Value">
                <input
                  v-model="item.core_value"
                  placeholder="N/A"
                  @blur="
                    item.core_value = normalizeCoreValue(item.core_value);
                    updateItemValue(item);
                  "
                />
              </td>

              <td data-label="Cert Type">
                <input
                  v-model="item.cert_type"
                  placeholder="Cert Type"
                  @blur="updateItemValue(item)"
                />
              </td>

              <td data-label="Unit Price">
                <input
                  type="text"
                  inputmode="decimal"
                  :value="item.unitPrice"
                  @input="item.unitPrice = parseCurrencyInput($event.target.value)"
                  @blur="updateItemValue(item)"
                />
              </td>

              <td data-label="Line Total">
                {{ formatCurrency(item.qty * item.unitPrice) }}
              </td>
              <td data-label="Remove">
                <button
                  type="button"
                  class="delete-btn"
                  @click="removeItem(index)"
                >
                  X
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="10" class="table-total-label">Grand Total</td>
              <td class="table-total-value">
                ${{ formatCurrency(quoteTotal) }}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div v-else class="empty-state">
        <h3>No parts added yet</h3>
        <p>Search a part number above and click <strong>Add Part</strong> to start building the quote.</p>
      </div>
    </form>

    <div class="action-bar">
    <div class="action-summary">
      <span>{{ items.length }} item(s)</span>
      <strong>${{ formatCurrency(quoteTotal) }}</strong>
    </div>
      <button
        type="button"
        class="create-btn action-btn"
        :disabled="savingQuote"
        @click="generatePDF"
      >
        {{
          savingQuote
            ? "Processing..."
            : isEdit
              ? "Update and Generate PDF"
              : "Generate PDF"
        }}
      </button>
    </div>
  </div>
</template>
<style scoped>
.delete-btn {
  background: #e53935;
  color: white;
  border: none;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.delete-btn:hover {
  background: #c62828;
}

.page {
  width: 100%;
  padding: 10px 0 36px;
  font-family: "Segoe UI", Roboto, Arial, sans-serif;
  background: transparent;
  color: var(--text-main);
  min-height: 100%;
}

h1 {
  font-size: 34px;
  font-weight: 800;
  margin-bottom: 10px;
  color: var(--text-strong);
  letter-spacing: -0.03em;
}

.page-top {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.8fr);
  align-items: stretch;
  gap: 20px;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #0f5fa6;
}

.page-subtitle {
  max-width: 820px;
  margin: 0;
  color: var(--text-muted);
  line-height: 1.5;
}

.quote-header {
  display: grid;
  align-content: center;
  gap: 10px;
  padding: 24px 26px;
  min-height: 160px;
  background:
    linear-gradient(135deg, rgba(15, 95, 166, 0.14), rgba(15, 23, 42, 0.04)),
    var(--bg-surface-solid);
  border: 1px solid rgba(15, 95, 166, 0.18);
  border-radius: 20px;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
}

.quote-header h2 {
  font-size: 12px;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #0f5fa6;
}

.quote-number,
.quote-meta {
  margin: 0;
  font-size: 15px;
  color: var(--text-main);
}

.quote-number {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-strong);
}

.mobile-toolbar {
  display: none;
}

.section-label {
  margin: 18px 0 10px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #64748b;
}

/* ADDRESS GRID */

.address-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-bottom: 18px;
}

.address-box {
  background: var(--bg-surface-solid);
  padding: 20px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.2s ease;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.05);
}

.address-box:hover {
  border-color: rgba(15, 95, 166, 0.26);
  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
}

.address-box h3 {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-strong);
  margin: 0 0 6px;
}

/* CLIENT + SALES */

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  margin-bottom: 20px;
}

.info-box {
  background: var(--bg-surface-solid);
  padding: 22px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.05);
}

.info-box h3 {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-strong);
  margin: 0 0 8px;
}

.info-box label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  margin-top: 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.part-card {
  background: var(--bg-surface-solid);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
}

.part-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.part-card-header h3 {
  margin: 0 0 6px;
  color: var(--text-strong);
  font-size: 24px;
  letter-spacing: -0.02em;
}

.part-card-header p {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
}

.part-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1.5fr;
  gap: 18px;
  align-items: end;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-block label {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.field-part {
  min-width: 0;
}

.field-description {
  min-width: 0;
}

/* INPUTS */

input,
select {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.32);
  font-size: 14px;
  background: var(--bg-soft);
  color: var(--text-main);
  transition: all 0.2s ease;
}

input::placeholder,
select::placeholder {
  color: var(--text-faint);
}

input[readonly],
input:disabled,
select:disabled {
  color: var(--text-main);
  -webkit-text-fill-color: var(--text-main);
  opacity: 1;
}

input:focus,
select:focus {
  background: var(--bg-surface-solid);
  border-color: #0f5fa6;
  box-shadow: 0 0 0 4px rgba(15, 95, 166, 0.14);
  outline: none;
}

/* FORM */

.form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* QUOTE TABLE */

.quote-table {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin-top: 18px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 20px;
  background: var(--bg-surface-solid);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.06);
}

.quote-table table {
  width: 100%;
  border-collapse: collapse;
  background: transparent;
  border-radius: 20px;
}

.quote-table th {
  background: linear-gradient(135deg, #0f5fa6 0%, #0d4d84 100%);
  color: white;
  padding: 15px 12px;
  font-size: 13px;
  font-weight: 700;
  text-align: left;
  white-space: nowrap;
}

.quote-table td {
  border-top: 1px solid rgba(226, 232, 240, 0.9);
  padding: 12px;
  font-size: 13px;
  vertical-align: top;
  color: var(--text-main);
}

.quote-table tr:hover {
  background: rgba(15, 95, 166, 0.04);
}

.quote-table tfoot td {
  background: rgba(15, 95, 166, 0.04);
  font-weight: 700;
}

.table-total-label {
  text-align: right;
  color: #0f172a;
}

.table-total-value {
  color: #0f5fa6;
  white-space: nowrap;
}

/* DESCRIPTION */

.description div {
  margin-bottom: 3px;
  font-size: 13px;
}

.col-cd,
.cell-cd {
  min-width: 120px;
  width: 120px;
}

/* TABLE INPUTS */

.quote-table input,
.quote-table select {
  width: 100%;
  min-width: 76px;
  padding: 10px 12px;
  font-size: 13px;
  border-radius: 10px;
}

.cd-control {
  min-width: 96px;
}

.empty-state {
  background: var(--bg-surface-solid);
  border: 1px dashed rgba(15, 95, 166, 0.28);
  border-radius: 20px;
  padding: 40px 28px;
  text-align: center;
  color: var(--text-muted);
}

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--text-strong);
}

.empty-state p {
  margin: 0;
  line-height: 1.5;
}

.action-bar {
  position: sticky;
  bottom: 12px;
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border: 1px solid rgba(15, 95, 166, 0.16);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(10px);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.1);
}

.action-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #334155;
  font-size: 14px;
}

.action-summary strong {
  font-size: 22px;
  color: var(--text-strong);
}

/* BUTTON */

.create-btn {
  padding: 14px 22px;
  background: linear-gradient(135deg, #0f5fa6 0%, #0d4d84 100%);
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.3px;
  transition: all 0.2s ease;
  box-shadow: 0 12px 24px rgba(15, 95, 166, 0.24);
}

.secondary-btn {
  padding: 14px 18px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 12px;
  background: var(--bg-surface-solid);
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 28px rgba(15, 95, 166, 0.28);
}

.create-btn:disabled {
  opacity: 0.7;
  cursor: wait;
  transform: none;
  box-shadow: none;
}

.add-btn,
.action-btn {
  margin-top: 0;
  white-space: nowrap;
}

@media (max-width: 1100px) {
  .page-top {
    grid-template-columns: 1fr;
  }

  .address-grid,
  .info-grid,
  .part-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .page {
    padding: 4px 0 24px;
  }

  h1 {
    font-size: 28px;
  }

  .mobile-toolbar {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 10px;
    margin: 0 0 16px;
  }

  .mobile-toolbar-summary {
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--bg-surface-solid);
    border: 1px solid rgba(148, 163, 184, 0.22);
    color: var(--text-muted);
    font-size: 12px;
  }

  .mobile-toolbar-summary strong {
    color: var(--text-strong);
    font-size: 16px;
  }

  .quote-header,
  .address-box,
  .info-box,
  .part-card,
  .empty-state {
    padding: 18px;
    border-radius: 18px;
  }

  .address-box,
  .info-box {
    gap: 12px;
  }

  .info-box label,
  .field-block label {
    font-size: 11px;
  }

  input,
  select {
    min-height: 46px;
    padding: 12px 14px;
    font-size: 16px;
  }

  .part-card-header h3 {
    font-size: 20px;
  }

  .part-card-header,
  .action-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .action-summary {
    justify-content: space-between;
  }

  .create-btn,
  .action-btn,
  .add-btn,
  .secondary-btn {
    width: 100%;
  }

  .quote-table table {
    min-width: 900px;
  }
}

@media (max-width: 640px) {
  .page-top {
    margin-bottom: 14px;
  }

  h1 {
    font-size: 24px;
  }

  .quote-number {
    font-size: 18px;
  }

  .page-subtitle,
  .quote-meta,
  .part-card-header p {
    font-size: 13px;
  }

  .action-bar {
    position: static;
    padding: 14px 16px;
    border-radius: 16px;
  }

  .action-summary {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }

  .action-summary strong {
    font-size: 20px;
  }

  .quote-header {
    min-height: auto;
    gap: 8px;
  }

  .mobile-toolbar {
    flex-direction: column;
  }

  .section-label {
    margin: 14px 0 8px;
  }

  .quote-table {
    overflow: visible;
    border: none;
    background: transparent;
    box-shadow: none;
  }

  .quote-table table,
  .quote-table thead,
  .quote-table tbody,
  .quote-table tr,
  .quote-table td {
    display: block;
    width: 100%;
  }

  .quote-table table {
    min-width: 0;
  }

  .quote-table thead,
  .quote-table tfoot {
    display: none;
  }

  .quote-table tbody {
    display: grid;
    gap: 14px;
  }

  .quote-table tr {
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 18px;
    background: var(--bg-surface-solid);
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
    overflow: hidden;
  }

  .quote-table td {
    border-top: 1px solid rgba(226, 232, 240, 0.9);
    padding: 12px 14px;
  }

  .quote-table td:first-child {
    border-top: none;
  }

  .quote-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 6px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .quote-table input,
  .quote-table select,
  .delete-btn {
    width: 100%;
  }

  .description div {
    margin-bottom: 6px;
  }
}
</style>
