<script setup>
import { useRoute } from "vue-router";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { onMounted, onBeforeUnmount, ref } from "vue";
import { useRouter } from "vue-router";
import { supabaseInventory } from "../../../supabase";
import { useFeedback } from "../../../composables/useFeedback";

const sending = ref(false);
const route = useRoute();
const router = useRouter();
let pdfBlobGlobal = null;
let items = [];
let client_email = "";
let client_contact = "";
let client_phone = "";
let client_exw = "";
let client_ref = "";
let validation_description = "";
const isPreview =
  route.query.preview === true ||
  route.query.preview === "true" ||
  route.query.preview === 1 ||
  route.query.preview === "1";
const isAutoSend =
  route.query.autoSend === true ||
  route.query.autoSend === "true" ||
  route.query.autoSend === 1 ||
  route.query.autoSend === "1";
const skipFollowUpLog =
  route.query.skipFollowUpLog === true ||
  route.query.skipFollowUpLog === "true" ||
  route.query.skipFollowUpLog === 1 ||
  route.query.skipFollowUpLog === "1";
const autoSendMode = String(route.query.autoSendMode || "default");
const customEmailSubject = String(route.query.emailSubject || "").trim();
const customEmailBody = String(route.query.emailBody || "");
const pdfUrl = ref(null);
const feedback = useFeedback();
const quote_number = route.query.quote_number;
const pdfFileName = `${quote_number || "quote"}.pdf`;

function notifyAutoSendParent(status, detail) {
  if (!isAutoSend || window.parent === window) return;

  window.parent.postMessage(
    {
      type: "inventory-auto-send-result",
      status,
      quoteNumber: quote_number,
      detail,
    },
    window.location.origin,
  );
}

// const sendEmail = async () => {
//   if (sending) return;
//   sending = true;

//   try {
//     if (!pdfBlobGlobal) {
//       alert("❌ No hay PDF generado");
//       return;
//     }

//     const formData = new FormData();
//     formData.append("pdf", pdfBlobGlobal, `${quote_number}.pdf`);
//     formData.append("email", client_email);
//     formData.append("quote", quote_number);

//     const response = await fetch(
//       "https://redskyg.com/administrador/send_quote.php",
//       {
//         method: "POST",
//         body: formData,
//       },
//     );

//     const data = await response.json();

//     if (data.success) {
//       alert("✅ Correo enviado correctamente");
//       router.back();
//     } else {
//       alert("❌ Error al enviar el correo");
//     }
//   } catch (error) {
//     console.error(error);
//     alert("❌ Error de conexión");
//   } finally {
//     sending = false; // 🔥 IMPORTANTE
//   }
// };
function safeArray(arr) {
  return arr.map((v) => String(v ?? ""));
}

function drawSectionLabel(doc, label, x, y, width) {
  doc.setFillColor(14, 34, 57);
  doc.roundedRect(x, y, width, 8, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(label, x + 4, y + 5.2);
  doc.setTextColor(25, 35, 52);
  doc.setFont("helvetica", "normal");
}

function drawInfoBox(doc, title, lines, x, y, width, height) {
  drawSectionLabel(doc, title, x, y, width);
  doc.setDrawColor(205, 216, 228);
  doc.setFillColor(252, 253, 255);
  doc.roundedRect(x, y + 8, width, height, 3, 3, "FD");
  doc.setFontSize(8);
  doc.setTextColor(58, 73, 91);
  doc.text(safeArray(lines), x + 4, y + 15);
  doc.setTextColor(25, 35, 52);
}

function drawDualInfoBox(doc, title, leftLines, rightLines, x, y, width, height) {
  drawSectionLabel(doc, title, x, y, width);
  doc.setDrawColor(205, 216, 228);
  doc.setFillColor(252, 253, 255);
  doc.roundedRect(x, y + 8, width, height, 3, 3, "FD");
  doc.line(x + width / 2, y + 12, x + width / 2, y + height + 4);
  doc.setFontSize(8);
  doc.setTextColor(58, 73, 91);
  doc.text(safeArray(leftLines), x + 4, y + 15);
  doc.text(safeArray(rightLines), x + width / 2 + 4, y + 15);
  doc.setTextColor(25, 35, 52);
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatLabeledValue(label, value) {
  return `${label}: ${value || ""}`;
}

function getCoreValueLabel(list) {
  const coreValues = [
    ...new Set(
      list
        .map((item) => item.core_value ?? item.coreValue ?? item.CORE_VALUE)
        .filter(
          (value) =>
            value !== undefined &&
            value !== null &&
            `${value}`.trim() !== "",
        )
        .map((value) => String(value).trim()),
    ),
  ];

  return coreValues.length ? coreValues.join(", ") : "PENDING";
}

function downloadPdf() {
  if (!pdfBlobGlobal) return;

  const blobUrl = URL.createObjectURL(pdfBlobGlobal);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = pdfFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

async function printPdf() {
  if (!pdfUrl.value) return;

  const printWindow = window.open(pdfUrl.value, "_blank", "noopener");

  if (!printWindow) {
    await feedback.warning(
      "No se pudo abrir la vista de impresion",
      "Permite ventanas emergentes para imprimir el PDF.",
    );
    return;
  }

  printWindow.addEventListener(
    "load",
    () => {
      printWindow.focus();
      printWindow.print();
    },
    { once: true },
  );
}

function editQuote() {
  if (!quote_number) return;

  router.push({
    name: "CreateInventoryQuote",
    query: {
      edit: "true",
      quote_number,
    },
  });
}

function goBack() {
  router.push({
    name: "QuotesValidation",
    query: {
      highlight_quote: quote_number,
    },
  });
}

function buildV2EmailBody() {
  if (customEmailBody) {
    return customEmailBody;
  }

  const contact = client_contact || "Cliente";
  const quoteNumber = quote_number || "N/A";

  return [
    `Estimado/a ${contact},`,
    "",
    `Adjuntamos la cotización actualizada ${quoteNumber} en formato PDF para su referencia.`,
    "Quedamos atentos a cualquier comentario o informacion adicional que requiera.",
    "",
    "Saludos cordiales,",
    "Sky Group Aviation",
  ].join("\n");
}

function buildFollowUpLogEntry(channel) {
  const timestamp = new Date().toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `[${timestamp}] Seguimiento enviado por ${channel}`;
}

const sendEmail = async () => {
  if (sending.value) return;
  sending.value = true;

  try {
    if (!pdfBlobGlobal) {
      await feedback.warning(
        "PDF not available",
        "Generate the PDF first before sending the quote.",
      );
      return;
    }

    const formData = new FormData();
    formData.append("pdf", pdfBlobGlobal, pdfFileName);
    formData.append("email", client_email);
    formData.append("quote", quote_number);
    formData.append("to", client_email);
    formData.append("quote_id", quote_number);
    formData.append("client_name", client_contact || "Cliente");
    formData.append(
      "subject",
      customEmailSubject || `Cotización actualizada ${quote_number || ""}`,
    );
    formData.append("body", buildV2EmailBody());

    const endpoint =
      autoSendMode === "v2"
        ? "https://redskyg.com/administrador/send_quote_v2.php"
        : "https://redskyg.com/administrador/send_quote.php";

    const response = await fetch(
      endpoint,
      {
        method: "POST",
        body: formData,
      },
    );

    const rawResponse = await response.text();
    let data = null;

    try {
      data = rawResponse ? JSON.parse(rawResponse) : null;
    } catch {
      data = null;
    }

    const sendSucceeded =
      response.ok &&
      (data?.success === true ||
        data?.ok === true ||
        /enviado|sent/i.test(String(data?.message || rawResponse || "")));

    if (sendSucceeded) {
      const nextDescription = skipFollowUpLog
        ? validation_description
        : (() => {
            const currentDescription = String(validation_description || "").trim();
            const logEntry = buildFollowUpLogEntry("Correo");
            return currentDescription
              ? `${currentDescription}\n${logEntry}`
              : logEntry;
          })();

      await supabaseInventory
        .from("quotes")
        .update({
          status: "seguimiento",
          sent_at: new Date(),
          ...(skipFollowUpLog ? {} : { validation_description: nextDescription }),
        })
        .eq("quote_number", quote_number);

      validation_description = nextDescription;

      notifyAutoSendParent(
        "success",
        skipFollowUpLog
          ? "The quote was emailed successfully."
          : "The quote was emailed and moved to seguimiento.",
      );

      if (isAutoSend) {
        return;
      }

      await feedback.success(
        "Quote sent successfully",
        skipFollowUpLog
          ? "The quote was emailed successfully."
          : "The quote was emailed and moved to seguimiento.",
      );

      router.push({
        name: "QuotesValidation",
        query: {
          highlight_quote: quote_number,
        },
      });
    } else {
      notifyAutoSendParent(
        "error",
        "The email service did not complete successfully.",
      );

      if (isAutoSend) {
        return;
      }

      await feedback.error(
        "Unable to send quote",
        null,
        data?.message ||
          data?.error ||
          rawResponse ||
          "The email service did not complete successfully.",
      );
    }
  } catch (error) {
    console.error(error);

    notifyAutoSendParent("error", "There was a problem sending the quote.");

    if (isAutoSend) {
      return;
    }

    await feedback.error(
      "Connection error",
      error,
      "There was a problem sending the quote.",
    );
  } finally {
    sending.value = false;
  }
};

// const sendEmail = async () => {
//   if (sending.value) return;
//   sending.value = true;

//   try {
//     if (!pdfBlobGlobal) {
//       alert("❌ No PDF generated");
//       return;
//     }

//     const formData = new FormData();
//     formData.append("pdf", pdfBlobGlobal, `${quote_number}.pdf`);
//     formData.append("email", client_email);
//     formData.append("quote", quote_number);

//     const response = await fetch("/send-email", {
//       method: "POST",
//       body: formData,
//     });

//     const data = await response.json();

//     if (data.success) {
//       // ✅ VALIDACIÓN FINAL
//       await supabaseInventory
//         .from("quotes")
//         .update({ status: "validated" })
//         .eq("quote_number", quote_number);

//       alert("✅ Sent and validated");

//       router.push({ name: "quotes-validation" });
//     } else {
//       alert("❌ Error sending email");
//     }
//   } catch (error) {
//     console.error(error);
//     alert("❌ Connection error");
//   } finally {
//     sending.value = false;
//   }
// };
// ITEMS
// const items = JSON.parse(route.query.items || "[]");
const loadQuote = async () => {
  const { data } = await supabaseInventory
    .from("quotes")
    .select("*")
    .eq("quote_number", quote_number)
    .single();

  // ITEMS
  items = data.items || [];
  client_contact = data.client_contact || "";
  client_phone = data.client_phone || "";
  client_email = data.client_email || "";
  client_exw = data.client_exw || "";
  client_ref = data.client_ref || "";
  validation_description = data.validation_description || "";

  // 🔥 BILL
  bill_company = data.bill_to?.company || "";
  bill_street = data.bill_to?.street || "";
  bill_number = data.bill_to?.number || "";
  bill_city = data.bill_to?.city || "";
  bill_postal = data.bill_to?.postal || "";
  bill_country = data.bill_to?.country || "";

  // 🔥 SHIP
  ship_company = data.ship_to?.company || "";
  ship_street = data.ship_to?.street || "";
  ship_number = data.ship_to?.number || "";
  ship_city = data.ship_to?.city || "";
  ship_postal = data.ship_to?.postal || "";
  ship_country = data.ship_to?.country || "";

  // 🔥 FINAL
  final_company = data.final_destination?.company || "";
  final_street = data.final_destination?.street || "";
  final_number = data.final_destination?.number || "";
  final_city = data.final_destination?.city || "";
  final_postal = data.final_destination?.postal || "";
  final_country = data.final_destination?.country || "";

  // 🔥 SALES (AQUI VA, NO AFUERA)
  sales_person = data.sales_info?.salesPerson || "";
  sales_email = data.sales_info?.email || "";
  sales_terms = data.sales_info?.terms || "";
  sales_valid = data.sales_info?.validUntil || "";
};

let sales_person = "";
let sales_email = "";
let sales_terms = "";
let sales_valid = "";

let bill_company = route.query.bill_company || "";
let bill_street = route.query.bill_street || "";
let bill_number = route.query.bill_number || "";
let bill_city = route.query.bill_city || "";
let bill_postal = route.query.bill_postal || "";
let bill_country = route.query.bill_country || "";


let ship_company = route.query.ship_company || "";
let ship_street = route.query.ship_street || "";
let ship_number = route.query.ship_number || "";
let ship_city = route.query.ship_city || "";
let ship_postal = route.query.ship_postal || "";
let ship_country = route.query.ship_country || "";


let final_company = route.query.final_company || "";
let final_street = route.query.final_street || "";
let final_number = route.query.final_number || "";
let final_city = route.query.final_city || "";
let final_postal = route.query.final_postal || "";
let final_country = route.query.final_country || "";

const generatePDF = () => {
  const doc = new jsPDF("p", "mm", "a4");
  doc.setDrawColor(205, 216, 228);
  doc.setTextColor(25, 35, 52);

  const date = new Date();
  const today =
    String(date.getDate()).padStart(2, "0") +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    date.getFullYear();

  // LOGO
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = "/administrador/images/logoo.png";

  img.onload = () => {
    console.log("DEBUG PDF", {
      items,
      bill_company,
      ship_company,
      final_company,
    });

    doc.setFillColor(11, 24, 43);
    doc.rect(0, 0, 210, 46, "F");
    doc.setFillColor(15, 95, 166);
    doc.rect(0, 46, 210, 4, "F");

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(8, 7, 60, 26, 4, 4, "F");
    doc.addImage(img, "PNG", 11, -5, 52, 50);

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13.5);
    doc.text("AVIATION PARTS QUOTATION", 78, 13);
    doc.setFontSize(8.3);
    doc.setFont("helvetica", "normal");
    doc.text("Sky Group Aviation", 78, 19);
    doc.text("The Green, Ste R, Dover, ", 78, 24);
    doc.text("Delaware 19901", 78, 29);
    doc.text("sales@redskyg.com", 78, 34);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(154, 8, 46, 28, 4, 4, "F");
    doc.setDrawColor(213, 223, 233);
    doc.roundedRect(154, 8, 46, 28, 4, 4, "S");
    doc.setTextColor(15, 95, 166);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Quote Summary", 177, 14, { align: "center" });
    doc.setTextColor(25, 35, 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.text(`Quote #: ${quote_number}`, 157, 20);
    doc.text(`Date: ${today}`, 157, 25);
    doc.text("Page: 1", 157, 30);
    doc.text("Priority: Routine", 157, 35);

    drawInfoBox(
      doc,
      "BILL TO",
      [
        formatLabeledValue("Company", bill_company),
        formatLabeledValue("Street", bill_street),
        formatLabeledValue("Number", bill_number),
        formatLabeledValue("City / State", bill_city),
        formatLabeledValue("Postal Code", bill_postal),
        formatLabeledValue("Country", bill_country),
      ],
      10,
      52,
      60,
      32,
    );

    drawInfoBox(
      doc,
      "SHIP TO",
      [
        formatLabeledValue("Company", ship_company),
        formatLabeledValue("Street", ship_street),
        formatLabeledValue("Number", ship_number),
        formatLabeledValue("City / State", ship_city),
        formatLabeledValue("Postal Code", ship_postal),
        formatLabeledValue("Country", ship_country),
      ],
      75,
      52,
      60,
      32,
    );

    drawInfoBox(
      doc,
      "FINAL DESTINATION",
      [
        formatLabeledValue("Company", final_company),
        formatLabeledValue("Street", final_street),
        formatLabeledValue("Number", final_number),
        formatLabeledValue("City / State", final_city),
        formatLabeledValue("Postal Code", final_postal),
        formatLabeledValue("Country", final_country),
      ],
      140,
      52,
      60,
      32,
    );

    drawDualInfoBox(
      doc,
      "CUSTOMER & SALES INFORMATION",
      [
        `Contact: ${client_contact || ""}`,
        `Phone: ${client_phone || ""}`,
        `Email: ${client_email || ""}`,
        `EXW: ${client_exw || ""}`,
        `Your Ref#: ${client_ref || ""}`,
      ],
      [
        `Sales Person: ${sales_person || ""}`,
        `Sales Email: ${sales_email || ""}`,
        `Terms: ${sales_terms || ""}`,
        `Valid Until: ${sales_valid || ""}`,
      ],
      10,
      86,
      190,
      36,
    );

    // ----------------------
    // GENERAR FILAS
    // ----------------------

    const tableRows = items.map((item, index) => {
      // const lineTotal = item.qty * item.unitPrice;
      const price = Number(item.unitPrice ?? item.unit_price ?? 0);
      const qty = Number(item.qty ?? 0);

      const lineTotal = qty * price;

      return [
        index + 1,

        `AIRCRAFT: ${item.aircraft || ""}
LOCATION: MEXICO
PART NUMBER: ${item.part_number || ""}
DESCRIPTION: ${item.description || ""}
CORE VALUE: ${item.core_value ?? item.coreValue ?? item.CORE_VALUE ?? ""}
CERT TYPE: ${item.cert_type ?? item.certType ?? "CofC"}`,

        item.cd || "SV",
        qty,
        item.um || "",
        item.delivery || "",
        formatMoney(price),
        formatMoney(lineTotal),
      ];
    });

    // TOTAL GENERAL

    const grandTotal = items.reduce((sum, item) => {
      const price = Number(item.unitPrice ?? item.unit_price ?? 0);
      const qty = Number(item.qty ?? 0);

      return sum + qty * price;
    }, 0);

    const coreValueLabel = getCoreValueLabel(items);

    // ----------------------
    // TABLA
    // ----------------------

    autoTable(doc, {
      startY: 126,
      theme: "grid",

      tableWidth: 190,

      margin: {
        left: 10,
        right: 10,
      },

      styles: {
        fontSize: 8,
        lineWidth: 0.2,
        lineColor: [209, 218, 229],
        cellPadding: 2.6,
        valign: "top",
        textColor: [25, 35, 52],
      },

      headStyles: {
        fillColor: [14, 34, 57],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "left",
      },

      alternateRowStyles: {
        fillColor: [248, 251, 255],
      },

      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 80 },
        2: { cellWidth: 26, fontSize: 8, halign: "center" },
        3: { cellWidth: 10 },
        4: { cellWidth: 10 },
        5: { cellWidth: 14 },
        6: { cellWidth: 20, halign: "right" },
        7: { cellWidth: 20, halign: "right" },
      },

      head: [
        [
          "Item",
          "Part Number / Description",
          "CD",
          "Qty",
          "UM",
          "Delivery",
          "Unit Price",
          "Line Total",
        ],
      ],

      body: tableRows,
    });

    // POSICIÓN FINAL
    const y = doc.lastAutoTable.finalY + 1;
    // ======================
    // CONDITIONS + BANK DETAILS (DINÁMICO PRO)
    // ======================

    // línea divisoria
    doc.line(10, y - 2, 200, y - 2);

    // título
    doc.setFontSize(9);
    drawSectionLabel(doc, "TERMS AND CONDITIONS", 10, y, 110);
    // contenido SIN título duplicado
    const textLines = [
      "1. The quotation is in dollars.",
      "2. Method of payment: 100% in advance.",
      "3. For bank transfers, please send proof of payment to: payments@redskyg.com",
      "4. Quotation validity: 15 days.",
      "5. 3 months warranty.",
      "6. Prices and lead time may change depending on certification.",
      "7. Equipment shipped after proof of payment.",
      "8. Freight or export costs are not included.",
      `9. Core value: ${coreValueLabel}`,
      "",

      "WIRE TRANSFERS FROM THE UNITED STATES:",
      " • Bank: Column N.A.",
      " • Bank Address: 1 Letterman Drive, Building A, Suite A4-700",
      "   San Francisco, CA 94129, USA",
      " • ABA Routing: 121145433",
      " • Beneficiary Name: Red Sky Group LLC",
      " • Beneficiary Address: 8 The Green, Ste R, Dover, DE 19901",
      " • Account Number: 749701713990491",
      " • Currency: USD",
      "",
      "FOR INTERNATIONAL WIRE TRANSFERS, use the information above, except for:",
      " • SWIFT / BIC Code: CLNOUS66MER",
      " • ABA ROUTING NUMBER: 121145433",
      "   If the sending bank does not recognize this ABA Routing Number, please use: 121145307",
      " • Intermediary Bank – Intermediary institution",
      "   SWIFT / BIC Code: CHASUS33XXX",
      " If the sending bank has an intermediary bank option, you may use this code: CHASUS33XXX",
      " • Currency: USD",
    ];

    // dividir texto
    const cleanTextLines = textLines
      .filter((line) => line !== undefined && line !== null)
      .map((line) => String(line));

    const splitText = doc.splitTextToSize(cleanTextLines, 105);
    // altura dinámica
    const lineHeight = 4;
    const textHeight = splitText.length * lineHeight;

    // caja
    doc.setFillColor(252, 253, 255);
    doc.roundedRect(10, y + 8, 110, textHeight + 8, 3, 3, "FD");
    doc.setFontSize(7);
    doc.setTextColor(58, 73, 91);
    doc.text(splitText || [""], 12, y + 18);
    doc.setTextColor(25, 35, 52);

    // ======================
    // TOTALS
    // ======================

    const totalsY = y + 8;
    drawSectionLabel(doc, "COMMERCIAL SUMMARY", 124, y, 76);
    doc.setFillColor(252, 253, 255);
    doc.roundedRect(124, totalsY, 76, 12, 3, 3, "FD");

    doc.text("Sub-Total:", 129, totalsY + 7);
    doc.text(formatMoney(grandTotal), 196, totalsY + 7, {
      align: "right",
    });

    doc.setFillColor(14, 34, 57);
    doc.roundedRect(124, totalsY + 13, 76, 14, 3, 3, "F");
    doc.setTextColor(255, 255, 255);

    doc.text("Grand Total:", 129, totalsY + 22);
    doc.text(formatMoney(grandTotal), 196, totalsY + 22, {
      align: "right",
    });
    doc.setTextColor(25, 35, 52);

    // ======================
    // FOOTER
    // ======================

    // posición REAL debajo del recuadro
    const footerY = y + textHeight + 20;

    doc.setFontSize(7);
    doc.setTextColor(91, 113, 135);

    doc.text(
      [
        "Please reference the quote number at the time of order.",
        "All material is offered subject to prior sale and final confirmation.",
        "This quotation is issued for aviation material review and procurement follow-up.",
      ],
      10,
      footerY,
    );
    doc.setTextColor(25, 35, 52);

    // ----------------------
    // ENVIAR EMAIL
    // ----------------------

    // DESCARGAR
    pdfBlobGlobal = doc.output("blob");

    if (pdfUrl.value) {
      URL.revokeObjectURL(pdfUrl.value);
    }

    pdfUrl.value = URL.createObjectURL(pdfBlobGlobal);

    // 🔥 CONTROL DE FLUJO

    // 👁 VIEW → solo mostrar
    if (isPreview) {
      return;
    }

    // ✔ VALIDATE → enviar automático
    if (isAutoSend) {
      setTimeout(() => {
        sendEmail();
      }, 800);
      return;
    }

    // 🟡 fallback (manual)
    setTimeout(async () => {
      const result = await feedback.confirm({
        title: "¿Enviar cotización?",
        text: "Review the PDF before sending it to the customer.",
        icon: "question",
        confirmButtonText: "Sí, enviar",
        cancelButtonText: "Keep reviewing",
      });

      if (result.isConfirmed) {
        sendEmail();
      }
    }, 1500);
  };
};

// GENERAR AUTOMATICAMENTE
onMounted(async () => {
  await loadQuote();

  if (items.length) {
    generatePDF();
  }
});

onBeforeUnmount(() => {
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value);
  }
});
</script>

<template>
  <div class="pdf-container">
    <div v-if="pdfUrl && !isAutoSend" class="pdf-toolbar">
      <div class="pdf-actions">
        <button type="button" class="back-btn" @click="goBack">
          Regresar
        </button>
        <button type="button" class="download-btn" @click="downloadPdf">
          Download PDF
        </button>
        <button type="button" class="print-btn" @click="printPdf">
          Imprimir
        </button>
        <button
          type="button"
          class="followup-btn"
          :disabled="sending"
          @click="sendEmail"
        >
          {{ sending ? "Enviando..." : "Seguimiento" }}
        </button>
        <button type="button" class="edit-btn" @click="editQuote">
          Editar
        </button>
      </div>
      <span class="pdf-filename">{{ pdfFileName }}</span>
    </div>

    <!-- 🔥 LO QUE FALTABA -->
    <iframe
      v-if="pdfUrl && !isAutoSend"
      :src="pdfUrl"
      class="pdf-frame"
      width="100%"
      height="700px"
    ></iframe>

    <!-- loading opcional -->
    <div v-else class="loading">
      {{ isAutoSend ? "Enviando cotizacion..." : "Generando PDF..." }}
    </div>
  </div>
</template>
<style>
.pdf-container {
  padding: 20px;
}

.pdf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.pdf-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.download-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  background: #0f5fa6;
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.print-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  background: #16a34a;
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.followup-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  background: #f59e0b;
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.followup-btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

.back-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  background: #0e2239;
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.edit-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 10px;
  background: #e8eef5;
  color: #334155;
  font-weight: 700;
  cursor: pointer;
}

.pdf-filename {
  color: #5b6b7c;
  font-size: 13px;
  word-break: break-word;
}

.loading {
  text-align: center;
  margin-top: 50px;
  font-size: 18px;
  color: gray;
}

.pdf-frame {
  min-height: calc(100dvh - 170px);
  border: 0;
  border-radius: 16px;
  background: white;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal {
  background: white;
  padding: 20px;
  border-radius: 10px;
  width: 300px;
  text-align: center;
}

.buttons {
  display: flex;
  justify-content: space-between;
  margin-top: 15px;
}

.btn {
  padding: 8px 15px;
  border: none;
  cursor: pointer;
}

.confirm {
  background: green;
  color: white;
}

.cancel {
  background: red;
  color: white;
}

@media (max-width: 768px) {
  .pdf-container {
    padding: 12px 0 20px;
  }

  .pdf-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .pdf-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .download-btn,
  .print-btn,
  .followup-btn,
  .edit-btn {
    width: 100%;
  }

  .pdf-frame {
    min-height: calc(100dvh - 230px);
  }
}
</style>
