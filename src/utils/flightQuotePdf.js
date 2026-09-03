import jsPDF from "jspdf";
import {
  getDisplayQuoteLegs,
  getFinalQuoteRoute,
  getDisplayRoutePath,
  getPrimaryQuoteRoute,
} from "@/utils/quoteRouteDisplay";
import { getLegMetricKey, getQuoteLegMetricsMap } from "@/utils/quoteLegMetrics";
import {
  getPreferredAircraftName,
  resolveAircraftDisplayName,
} from "@/utils/aircraftDisplay";
import { buildQuoteCommercialBreakdownPresentation } from "@/utils/flightQuotePricing";

const PAGE = {
  width: 210,
  height: 297,
  marginX: 20,
  contentWidth: 170,
  footerY: 287,
};

const FIRST_PAGE_CONTENT_MAX_Y = 266;
const CONTACT_DETAILS = {
  phone: "+52 55 8618 6576 | +52 722 112 6671",
  email: "ventas@redaviationcorp.com",
  website: "https://www.redskyg.com/mx",
};

const COLORS = {
  ink: [15, 23, 42],
  inkSoft: [41, 45, 51],
  steel: [71, 85, 105],
  steelSoft: [107, 114, 128],
  accent: [10, 31, 51],
  navy: [16, 55, 89],
  red: [181, 32, 37],
  redDeep: [169, 31, 35],
  gold: [190, 137, 62],
  goldSoft: [247, 242, 232],
  accentSoft: [232, 238, 246],
  line: [214, 223, 233],
  panel: [248, 251, 255],
  row: [241, 246, 250],
  white: [255, 255, 255],
};

const PAYMENT_DETAILS = [
  ["BANCO", "BBVA MEXICO"],
  ["TITULAR", "RED AVIATION COMPANY S.A. DE C.V."],
  ["CLABE", "012441001238761521"],
  ["CUENTA", "00744677210123876152"],
  ["RFC TITULAR", "RAV240815EN5"],
];

const CONTRACT_DATE_TOKEN = "__CONTRACT_CURRENT_DATE__";

const CONTRACT_TERMS_SOURCE = `# **AGREEMENT TO CHARTER AIRCRAFT CAPACITY**

This Agreement is made as of this (Date) **${CONTRACT_DATE_TOKEN}**.

BETWEEN **RED AVIATION COMPANY, S.A. DE C.V.**, corporation duly incorporated under the laws of the United Mexican States, having its headquarters at **CIRCUITO ALFONSO G. DE OROZCO, MANZANA 007, C.P. 50225, SAN MIGUEL TOTOLTEPEC, TOLUCA DE LERDO, ESTADO DE MEXICO**, herein represented by its duly authorized representative **JOSE LUIS HERNANDEZ ORTIZ**, hereinafter referred to as **"RED AVIATION"**.

AND (Company)

____________________________________________________________________________________________________,

a corporation duly incorporated under the laws of ______________________________________________ with address at

(Address) _______________________________________________________________________________________

and herein represented by its duly authorized representative

(Full Name) _____________________________________________________________________________________

(herein referred to as the **"Charterer"**).

WHEREAS RED AVIATION has arranged and contracted for the charter service described in the Quote attached hereto, which flight shall be performed by the duly authorized air carrier/operator responsible for the operation of the Aircraft (the **"Operator"**);

WHEREAS the Charterer wishes to charter an Aircraft arranged by RED AVIATION, on behalf of its client where applicable, for the purposes of performing the series of flights described in the Quote attached hereto.

**NOW THEREFORE, THE PARTIES AGREE AS FOLLOWS:**

## **1. DEFINITIONS**

**1. "Aircraft"** means the aircraft identified in the Quote and/or Appendix A attached hereto. In case of failure or unavailability of the aircraft, RED AVIATION will use commercially reasonable efforts to arrange the service on a similar aircraft, with no additional cost for the Charterer to the extent the substitute is provided under the same operational conditions, subject to prior notification to the Charterer of any substitute aircraft.

**2. "Aviation Authority"** means any person who shall from time to time be vested with the control and supervision of, or have jurisdiction over, the registration, airworthiness, operation or other matters relating to civil aviation in Mexico or any other applicable country, including without limitation the destination country as well as the countries over which an Aircraft has to fly for the purpose of this Agreement.

**3. "Business Day"** means a day on which the banks in the USA are open for the transaction of business of the type required by this Agreement.

**4. "Deposit"** means the amount in Dollars referred to in Section 4 of this Agreement and set out in Appendix A hereto attached, required by RED AVIATION to guarantee the Charterer's performance of its obligations under this Agreement.

**5. "Dollars"** and the sign **"$"** each mean the lawful currency of the United States, unless otherwise specified.

**6. "Effective Date"** means the date of signature by the parties of this Agreement.

**7. "In-Flight Services"** means meals and wine, soft beverages, coffee, tea and water, audio entertainment service, featured films, earphones and bar service, and are not included on these particular flights unless expressly stated otherwise in the Quote.

**8. "Taxes and Fees"** means and includes in respect of the flights described in Appendix A, without limitation, all present or future taxes, license and documentation fees, goods and services taxes, levies, fiscal charges, imposts, duties, fees, assessments, surcharges, conditions or other charges of whatever nature and however arising which are imposed, assessed, charged, levied, withheld, deducted, demanded or otherwise applied pursuant to applicable law or regulation by the appropriate governments and Aviation Authorities, together with all interest thereon and penalties or similar liabilities with respect thereto, but excluding taxes based on RED AVIATION's income and capital from this Agreement, the whole as set out in the tax grid provided by RED AVIATION to the Charterer.

**9. "Total Aircraft Cost"** means the price stated in the formal quote previously sent by RED AVIATION, hereinafter referred to as the **"Appendix A"**.

## **2. TERM**

The terms and provisions of this Agreement shall be effective from the Effective Date until the day when the flight is completed.

## **3. CHARTERED CAPACITY**

Subject to Section 5 hereof, RED AVIATION arranges for the Charterer the charter service for the Aircraft, along with In-Flight Services, as set out in Appendix A attached hereto. The actual operation of the flight shall be performed by the Operator responsible for the applicable flight.

## **4. TOTAL ROTATION PRICE AND DEPOSIT**

Subject to Sections 5 and 15 of this Agreement, the Charterer shall pay to RED AVIATION the **Total Rotation Price** in respect of all rotations covered by this Agreement as set out in Appendix A hereto, plus **Taxes and Fees**.

Upon execution of this Agreement, the Charterer agrees to pay to RED AVIATION a **Deposit** in the amount set out in Appendix A. The Deposit shall be in the form of wire transfer and should be submitted at least **48 hours before departure**, unless otherwise agreed in writing.

## **5. CONDITIONS OF PAYMENT**

The Charterer agrees to pay in full to RED AVIATION, at least **seven (7) calendar days prior to each departure date**, the Total Rotation Price set out in Appendix A in respect of the concerned flight.

Taxes and Fees shall be paid to RED AVIATION within **seven (7) days** following the concerned flight, or sooner if required by RED AVIATION due to payment obligations to third parties.

All payments of the Total Rotation Price plus Taxes and Fees and any other amounts to be paid by the Charterer hereunder shall be paid in **US Dollars** by wire transfer to the account designated by RED AVIATION in writing.

## **6. TAXES AND FEES**

The Charterer agrees to pay all Taxes and Fees associated with the departures specified on the Cover Page of this Agreement.

The Charterer shall pay RED AVIATION for all additional taxes, fees, and operational costs incurred during the flight, including but not limited to **FBO extra charges, special event fees, premium catering, and de-icing/anti-icing services**; all such amounts must be settled in full by the Charterer prior to the completion of the contract.

In calculating the Aircraft Price, RED AVIATION may have assumed an average fuel price as stated in the Quote. In the event the actual fuel price exceeds this threshold, RED AVIATION may apply a **fuel surcharge** based on the documented cost increase above said threshold, which must be paid by the Charterer in accordance with the payment instructions provided by RED AVIATION.

## **7. SALES TO A THIRD PARTY**

Notwithstanding any provision of this Agreement, RED AVIATION hereby acknowledges that the Charterer has the right to resell or otherwise transfer any seat on the flights hereunder to travel agencies and tour operators, provided such resale does not alter the operational conditions of the flight and is made in compliance with applicable law.

## **8. ADVERTISING**

The Charterer may not use the name or logo of **RED AVIATION**, the name, logo, any photograph, video or film containing an image of RED AVIATION's Aircraft, nor any trade name or trademark of RED AVIATION in any of the Charterer's advertising material in connection with the flights covered by this Agreement, without the prior consent of RED AVIATION, which shall not be withheld unreasonably.

## **9. BAGGAGE**

The Operator will carry, without additional charge, checked baggage up to a weight limit as specified by the Operator's applicable policy, which may change from time to time with prior written notice.

Excess baggage charges will be assessed to each passenger according to the applicable policy.

## **10. TICKETS, PASSENGER/SALES INFORMATION**

**1.** The Charterer undertakes to provide RED AVIATION, upon request, with all passenger information reasonably required for the operation of the flight and compliance with applicable aviation, security, immigration and customs requirements.

**2.** The Charterer agrees to submit the flight manifests to RED AVIATION at least **72 hours before flight departure**, or within the period required by the Operator or applicable authority.

**3.** RED AVIATION may transmit such passenger information to the Operator and other service providers strictly to the extent necessary for the performance of the contracted flight and compliance with applicable law.

## **11. REPRESENTATIONS AND OPERATING CONDITIONS**

RED AVIATION represents to the Charterer that RED AVIATION is duly organized, validly existing and in good standing under the laws of Mexico and has the legal capacity to enter into this Agreement.

The Parties acknowledge that **RED AVIATION is not the operating air carrier of the flight** unless expressly stated otherwise in writing. The Aircraft shall be operated by the **Operator** responsible for the applicable flight.

The Operator responsible for the flight shall be responsible for maintaining and operating the Aircraft in a safe and airworthy condition and in accordance with all applicable laws, rules and regulations, and shall provide duly qualified flight crew, maintenance personnel and other personnel required for the operation.

RED AVIATION shall use commercially reasonable efforts to arrange the contracted flight with an Operator duly authorized to perform the applicable operation.

Where required under law, RED AVIATION shall coordinate with the Operator regarding any applicable protection of advance payments and operational requirements.

**Consents and Approvals.** The operation of the flight is conditioned upon the timely receipt of all governmental consents, permits, landing rights and approvals required for the flight. RED AVIATION shall use commercially reasonable efforts to coordinate such requirements with the Operator.

## **12. INSURANCE**

RED AVIATION shall use commercially reasonable efforts to arrange the contracted flight with an Operator maintaining the insurance required by applicable law and customary for the operation of the Aircraft.

Upon reasonable request and subject to availability, RED AVIATION may provide the Charterer with evidence of applicable insurance coverage from the Operator.

## **13. EVENTS OF DEFAULT AND TERMINATION**

**1. Each of the following events shall constitute an Event of Default:**

**a.** Failure on the part of the Charterer to pay any Total Rotation Price and any other amount payable by the Charterer hereunder within **five (5) Business Days** after such payment has not been made when due and payable.

**b.** Failure by RED AVIATION to arrange the contracted flight or to comply with a material obligation of this Agreement, where such failure is not remedied within **twenty-four (24) hours** after receiving written notice from the Charterer, to the extent such failure is reasonably capable of remedy.

**c.** Either party failing to perform or observe any other covenant, condition or provision of this Agreement and such failure is not remedied within **seven (7) calendar days** after receiving notice from the non-defaulting party.

**d.** Either party voluntarily suspending all or substantially all of its business operations.

**e.** Either party instituting proceedings to be adjudicated a bankrupt or insolvent, to be wound-up, consenting to the institution of bankruptcy, insolvency, liquidation, debt protection or winding-up proceedings against either party, filing a petition, answer or consent seeking dissolution or winding-up under any bankruptcy, insolvency or analogous laws, or if any such proceedings are commenced in respect of either party and are not being contested in good faith within five (5) calendar days after such party becomes aware thereof, or if either party consents to the filing of any such petition or to the appointment of a receiver over its business and assets generally or makes a general assignment for the benefit of creditors.

**f.** If an encumbrancer, secured party, receiver (or other similar representative) or sheriff (or other similar officer) seizes or takes possession of any material assets of either party.

**g.** The suspension of payments by either party, the failure to pay its debts generally or admitting in writing its inability to pay its debts generally as they become due.

**h.** The cancellation or termination of any license, consent, permit or authorization, or the failure to renew the foregoing, required in connection with the performance of either party's obligations under this Agreement.

**2.** Upon the occurrence of an Event of Default, the non-defaulting party shall have the cumulative right, in addition to any other right under this Agreement and by law, to enforce this Agreement or terminate this Agreement by written notice, and to recover amounts due and owing, reasonable costs and expenses incurred in connection with the exercise of its remedies, and direct damages recoverable under applicable law.

## **14. FORCE MAJEURE**

**1.** Neither party shall be liable for any delay or failure in the performance of any obligation under this Agreement due to any cause beyond its reasonable control, including without limitation, acts of God, acts of government, civil war or disobedience, fires, floods, explosions, earthquakes, serious accidents, epidemics, quarantine restrictions, strikes, lock outs or other labor disputes, embargos, riots, insurrections, war, acts of the public enemy or damage or destruction to the Aircraft or facilities and equipment due to any cause beyond reasonable control.

**2.** In the event of a Force Majeure event, RED AVIATION shall notify the Charterer as soon as reasonably practicable and shall use commercially reasonable efforts to coordinate an alternative flight or other reasonable solution, subject to availability and any additional costs imposed by the Operator or third parties.

**3.** If the flight cannot be operated due to Force Majeure, RED AVIATION shall refund amounts paid, less any administrative, operational, taxes or third-party costs actually incurred and non-refundable, with reasonable supporting documentation.

**4.** Either party may terminate this Agreement by written notice if the Force Majeure event makes performance impossible or commercially unreasonable.

## **15. INDEMNIFICATION**

**1.** RED AVIATION will indemnify and keep indemnified, hold harmless and defend the Charterer and its employees, agents, directors, officers, subcontractors and representatives from and against liabilities, costs, losses, damages, claims, demands, suits, judgments, actions and expenses arising directly from RED AVIATION's gross negligence or willful misconduct in connection with this Agreement.

**2.** The Charterer shall indemnify and hold RED AVIATION free and harmless from and against losses, expenses, costs, damages, demands and claims arising directly from the gross negligence or willful misconduct of the Charterer.

**3.** The indemnification provisions of this clause shall survive the termination of this Agreement.

**4.** Claims arising directly from the operation of the Aircraft, including passenger injury, death, baggage or third-party property damage, shall be subject to the applicable liability regime and insurance maintained by the Operator responsible for the flight, to the extent applicable.

**5. Nothing in this Agreement shall be construed as making RED AVIATION the operating air carrier of the flight.**

## **16. GOVERNING LAW**

This Agreement shall be construed and enforced in accordance with, and the rights of the parties shall be governed by, the laws of the **United Mexican States**.

There shall be no application of any conflict of laws rules inconsistent with this Section.

Each of the parties irrevocably submits to the jurisdiction of the competent courts of **Toluca, Estado de Mexico, Mexico**, and the parties irrevocably agree that all claims in respect of any action or proceeding arising out of or relating to this Agreement may be heard and determined by such courts.

## **17. MISCELLANEOUS**

**1. Entire Agreement.** This Agreement, including any Appendix thereto, represents the entire agreement and understanding between the parties hereto with respect to the subject matter hereof and shall supersede all prior agreements made by any party, whether written or oral. This Agreement may only be modified by writings signed by an authorized representative of all parties.

**2. No Waiver.** No waiver of any provision of this Agreement shall be deemed, or shall constitute, a waiver of any other provision whether or not similar, nor shall any waiver constitute a continuing waiver. Further, no waiver shall be binding unless executed in writing by the party making such waiver.

**3. Severability.** Any provision of this Agreement that is prohibited or unenforceable in any jurisdiction shall, as to such jurisdiction, be ineffective to the extent of such unenforceability without invalidating the remaining provisions hereof.

**4. No Agency.** Neither anything herein contained nor shall any act of the parties be deemed or construed by the parties or by a third person to create the relationship of mandatary, agent, partnership, joint venture or any association between the parties.

**5. Operator's Terms.** This Agreement may be subject to the operational terms and conditions of the Operator responsible for the flight to the extent applicable to the performance of the flight. In the event of conflict with this Agreement, the terms of this Agreement shall govern the contractual relationship between RED AVIATION and the Charterer to the extent permitted by applicable law.

**6. Confidentiality.** The Charterer and RED AVIATION undertake to maintain strict confidentiality regarding the terms and conditions of this Agreement, including all financial, business and operational information relating to either party.

Neither party will disclose such Confidential Information to any third party except where such disclosure is necessary to fulfill obligations under this Agreement, required by law or agreed otherwise in writing.

**7. Assignment.** Neither party may assign this Agreement without the prior written consent of the other party. This Agreement shall be binding upon the parties hereto, their successors and their permitted assignees.

**8. Time of the Essence.** Time is of the essence with respect to the performance by RED AVIATION and the Charterer of their obligations hereunder.

**9. Counterpart Executions.** This Agreement may be executed in one or more counterparts; each of which when so executed and delivered shall be deemed to be an original, but all such counterparts together shall constitute one and the same agreement.

This Agreement may be executed and delivered electronically, which when so executed and delivered shall constitute a binding agreement.

**10. Notices.** All notices required or permitted by this Agreement to be given to either party shall be in writing and shall be delivered by personal service, courier or email to the party receiving the notice at its address and to its representative as first written above.

Notices hereunder shall be deemed to be given upon receipt by email, provided that the sender does not receive an automated delivery failure notice.

**11. Language.** The parties have expressly required that this Agreement and all documents relating hereto be drafted in English.

## **18. CANCELLATION FEES**

Subject to Section 15.1 of this Agreement, in the event that the Charterer cancels the flight, the Charterer shall pay to RED AVIATION the following cancellation fees, with the date of cancellation being the date on which RED AVIATION receives written notice of cancellation of a flight from the Charterer.

Charges can be made against the deposit.

**a)** More than seven (7) calendar days prior to the scheduled date of departure of a flight or flights, **zero percent (0%)** of the Total Rotation Price related to the said cancelled flight(s), except for any non-refundable third-party costs actually incurred.

**b)** Less than seven (7) days in advance prior to the scheduled date of departure of a flight or flights, **fifteen percent (15%)** of the Total Rotation Price related to the said cancelled flight(s), or applicable non-refundable third-party costs, whichever is greater.

**c)** Less than five (5) days in advance to the scheduled date of departure of a flight or flights, **fifty percent (50%)** of the Total Rotation Price related to the said cancelled flight(s), or applicable non-refundable third-party costs, whichever is greater.

**d)** From three (3) calendar days prior to the scheduled date of departure of flight, **100% percent of the total price**, with no reimbursement, except as otherwise expressly agreed in writing.

Any credit memo or reimbursement, if applicable, shall be subject to the terms agreed in writing between RED AVIATION and the Charterer and, where applicable, to amounts actually recoverable from the Operator or other third parties.

# **IN WITNESS WHEREOF**

The parties hereto have executed and delivered this Agreement on (Date) **${CONTRACT_DATE_TOKEN}**.

### **RED AVIATION COMPANY, S.A. DE C.V.**

**By:** __________________________________________

**Name: JOSE LUIS HERNANDEZ ORTIZ**

**Title: Authorized Representative**

### **THE CHARTERER**

**By:** __________________________________________

**Name:** ________________________________________

**Title:** _________________________________________`;

function formatDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().split("T")[0];
}

function formatDocumentDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(date)
    .replace(/ /g, " ")
    .toUpperCase();
}

function formatContractLongDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatProfileDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })
    .format(date)
    .replace(",", " •")
    .toUpperCase();
}

function formatMoney(value = 0) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function isSavedFlightQuote(quote) {
  return (
    Array.isArray(quote?.flight_quote_legs) ||
    Boolean(quote?.route_summary) ||
    quote?.total_usd !== undefined
  );
}

function hasSavedQuoteLegs(quote) {
  return Array.isArray(quote?.flight_quote_legs) && quote.flight_quote_legs.length > 0;
}

function getAirportCode(value) {
  if (typeof value === "string") return value.trim().toUpperCase();

  return String(
    value?.iata ||
      value?.IATA ||
      value?.icao ||
      value?.ICAO ||
      value?.aeropuerto ||
      value?.airport_code ||
      "",
  )
    .trim()
    .toUpperCase();
}

function getAirportDisplay(code, name) {
  const normalizedCode = getAirportCode(code) || "-";
  const normalizedName = String(name || "").trim();
  const suffixMatch = normalizedName.match(/\s+(international\s+airport)$/i);
  const rawShortName = suffixMatch
    ? normalizedName.slice(0, suffixMatch.index).trim()
    : normalizedName;
  const shortName = (/^[A-ZÁÉÍÓÚÜÑ\s.'-]+$/.test(rawShortName)
    ? rawShortName.toLocaleLowerCase("es-MX").replace(/(^|[\s.'-])([a-záéíóúüñ])/g, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase("es-MX")}`)
    : rawShortName
  ).replace(/^Licenciado\b/i, "Lic.");

  return {
    name: normalizedName ? `${shortName || normalizedCode} - ${normalizedCode}` : normalizedCode,
    detail: "",
  };
}

function formatPdfDistance(value) {
  const label = String(value || "").trim();
  return label && label !== "-" ? `${label.replace(/\s*NM$/i, "")} NM` : "-";
}

function formatPdfTime(value) {
  const label = String(value || "").trim();
  const match = label.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/i);
  if (!match || (!match[1] && !match[2])) return "-";

  if (Number(match[1] || 0) === 0 && Number(match[2] || 0) === 0) {
    return "-";
  }

  return `${String(Number(match[1] || 0)).padStart(2, "0")}:${String(Number(match[2] || 0)).padStart(2, "0")}`;
}

function getDurationLabel(value) {
  const hours = Number(value);

  if (!Number.isFinite(hours) || hours <= 0) return "-";

  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (wholeHours && minutes) {
    return `${wholeHours}h ${minutes}m`;
  }

  if (wholeHours) {
    return `${wholeHours}h`;
  }

  return `${minutes}m`;
}

function getSavedQuoteLegs(quote) {
  return [...(quote?.flight_quote_legs || [])]
    .sort((left, right) => Number(left?.leg_order || 0) - Number(right?.leg_order || 0))
    .map((leg) => {
      const legType = String(leg?.leg_type || "").toLowerCase();
      const isStartPositioning =
        legType === "positioning" || legType === "repositioning";
      const isReturnToBase = legType === "return_to_base";

      return {
        id: leg?.id,
        from_airport: leg?.from_iata || leg?.from_icao || "-",
        from_airport_name: leg?.from_airport_name || "",
        to_airport: leg?.to_iata || leg?.to_icao || "-",
        to_airport_name: leg?.to_airport_name || "",
        aircraft_id: quote?.aircraft_id || null,
        aircraft_fleet: {
          name: quote?.aircraft_name || "-",
        },
        passengers: leg?.passengers || quote?.passengers || null,
        positioning: isStartPositioning || isReturnToBase,
        positioningLabel: isReturnToBase ? "Return to base" : "Repositioning",
        distanceLabel:
          leg?.distance_nm == null ? "-" : String(Math.round(Number(leg.distance_nm) || 0)),
        durationLabel:
          leg?.billable_hours == null
            ? "-"
            : getDurationLabel(leg?.billable_hours),
      };
    });
}

function getSnapshotQuoteLegs(quote) {
  const snapshotLegs =
    quote?.calculation_snapshot?.billableLegs ||
    quote?.calculation_snapshot?.billableRoutes ||
    quote?.calculation_snapshot?.legs ||
    [];

  if (!Array.isArray(snapshotLegs) || !snapshotLegs.length) return [];

  return snapshotLegs
    .map((leg, index) => {
      const positioningType = leg?.positioningType || leg?.leg_type || "";
      const isReturnToBase = positioningType === "return_to_base";
      const isPositioning =
        positioningType === "repositioning" ||
        positioningType === "positioning" ||
        isReturnToBase;
      const fromAirport = getAirportCode(leg?.from_airport || leg?.from || leg?.from_iata);
      const toAirport = getAirportCode(leg?.to_airport || leg?.to || leg?.to_iata);

      if (!fromAirport || !toAirport) return null;

      return {
        id: leg?.id || `snapshot-leg-${index}`,
        from_airport: fromAirport,
        from_airport_name: leg?.from_airport_name || leg?.fromAirportName || "",
        to_airport: toAirport,
        to_airport_name: leg?.to_airport_name || leg?.toAirportName || "",
        aircraft_id: quote?.aircraft_id || leg?.aircraft_id || null,
        aircraft_fleet: {
          name: quote?.aircraft_name || "-",
        },
        passengers: leg?.passengers || quote?.passengers || null,
        positioning: isPositioning,
        positioningLabel: isReturnToBase ? "Return to base" : "Repositioning",
        distanceLabel:
          leg?.miles == null && leg?.distance_nm == null
            ? "-"
            : String(Math.round(Number(leg?.miles ?? leg?.distance_nm) || 0)),
        durationLabel: getDurationLabel(
          leg?.billableHours ?? leg?.billable_hours ?? leg?.estimatedHours,
        ),
      };
    })
    .filter(Boolean);
}

function getRouteSummaryQuoteLegs(quote) {
  const codes = String(quote?.route_summary || "")
    .split("-")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

  if (codes.length < 2) return [];

  const closedCodes =
    codes[codes.length - 1] === codes[0] ? codes : [...codes, codes[0]];

  return closedCodes.slice(0, -1).map((fromAirport, index) => {
    const isRoundTripToBase =
      closedCodes.length > 2 && closedCodes[0] === closedCodes[closedCodes.length - 1];
    const isFirstPositioning = isRoundTripToBase && index === 0;
    const isReturnToBase = isRoundTripToBase && index === closedCodes.length - 2;

    return {
      id: `route-summary-leg-${index}`,
      from_airport: fromAirport,
      to_airport: closedCodes[index + 1],
      aircraft_id: quote?.aircraft_id || null,
      aircraft_fleet: {
        name: quote?.aircraft_name || "-",
      },
      passengers: quote?.passengers || null,
      positioning: isFirstPositioning || isReturnToBase,
      positioningLabel: isReturnToBase ? "Return to base" : "Repositioning",
      distanceLabel: "-",
      durationLabel: "-",
    };
  });
}

function getPdfLegs(quote) {
  if (hasSavedQuoteLegs(quote)) return getSavedQuoteLegs(quote);

  const snapshotLegs = getSnapshotQuoteLegs(quote);
  if (snapshotLegs.length) return snapshotLegs;

  const displayLegs = getDisplayQuoteLegs(quote);
  if (displayLegs.length) return displayLegs;

  return getRouteSummaryQuoteLegs(quote);
}

async function getPdfLegMetricsMap(quote, legs) {
  const computedMetrics = await getQuoteLegMetricsMap(legs);

  if (!isSavedFlightQuote(quote)) {
    return computedMetrics;
  }

  return legs.reduce((metrics, leg, index) => {
    const computed = computedMetrics[getLegMetricKey(leg, index)] || {};
    const savedDistance = String(leg?.distanceLabel || "").trim();
    const savedDuration = String(leg?.durationLabel || "").trim();
    const hasSavedDistance = savedDistance && savedDistance !== "-" && savedDistance !== "0";
    const hasSavedDuration =
      savedDuration &&
      savedDuration !== "-" &&
      !/^0+h(?:\s+0+m)?$/i.test(savedDuration) &&
      !/^0+m$/i.test(savedDuration);

    metrics[getLegMetricKey(leg, index)] = {
      distanceLabel: hasSavedDistance ? savedDistance : computed.distanceLabel,
      durationLabel: hasSavedDuration ? savedDuration : computed.durationLabel,
    };
    return metrics;
  }, {});
}

function getQuoteRoutePath(quote) {
  return isSavedFlightQuote(quote)
    ? quote?.route_summary || "-"
    : getDisplayRoutePath(quote);
}

async function getQuoteAircraftName(quote, firstRoute) {
  const fallbackName = getPreferredAircraftName(
    isSavedFlightQuote(quote) ? quote?.aircraft_name : firstRoute?.aircraft_fleet?.name,
    firstRoute?.aircraft_id || quote?.aircraft_id,
    "-",
  );

  if (fallbackName !== "-") return fallbackName;

  return resolveAircraftDisplayName({
    aircraftId: firstRoute?.aircraft_id || quote?.aircraft_id,
    aircraftName: isSavedFlightQuote(quote)
      ? quote?.aircraft_name
      : firstRoute?.aircraft_fleet?.name,
    fallback: "-",
  });
}

function getTripType(quote) {
  if (!isSavedFlightQuote(quote)) return quote?.flight_type || "Private Charter";

  return quote?.operation_type === "international"
    ? "International Charter"
    : "National Charter";
}

function drawTextPair(doc, label, value, x, y, width = 70) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.steel);
  doc.text(label.toUpperCase(), x, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  const lines = doc.splitTextToSize(String(value || "-"), width);
  doc.text(lines, x, y + 5.2);
  return lines.length;
}

function drawInlineMetricsRow(doc, items, x, y, width = 70) {
  const visibleItems = Array.isArray(items) ? items.filter((item) => item && item.label) : [];
  if (!visibleItems.length) return 0;

  const gutter = 4;
  const columnWidth = (width - gutter * (visibleItems.length - 1)) / visibleItems.length;
  let maxLines = 1;

  visibleItems.forEach((item, index) => {
    const columnX = x + index * (columnWidth + gutter);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.steel);
    doc.text(String(item.label || "-").toUpperCase(), columnX, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.ink);
    const lines = doc.splitTextToSize(String(item.value || "-"), columnWidth);
    doc.text(lines, columnX, y + 5.2);
    maxLines = Math.max(maxLines, lines.length);
  });

  return maxLines;
}

function getInfoCardHeight(doc, rows, width) {
  let height = 17;

  rows.forEach((row) => {
    if (row?.type === "inline-metrics") {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const items = Array.isArray(row.items) ? row.items.filter((item) => item && item.label) : [];
      const gutter = 4;
      const columnWidth = (width - 12 - gutter * Math.max(items.length - 1, 0)) / Math.max(items.length, 1);
      const maxLines = items.reduce((currentMax, item) => {
        const lines = doc.splitTextToSize(String(item.value || "-"), columnWidth);
        return Math.max(currentMax, lines.length);
      }, 1);
      height += 6.5 + maxLines * 3.2;
      return;
    }

    const [, value] = row;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(String(value || "-"), width - 12);
    height += 6.5 + lines.length * 3.2;
  });

  return Math.max(42, height + 4);
}

function drawTopBand(doc) {
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, PAGE.width, 6, "F");
  doc.setFillColor(...COLORS.gold);
  doc.rect(0, 6, PAGE.width, 0.9, "F");
}

function drawPageFrame(doc) {
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.rect(9.5, 9.5, PAGE.width - 19, PAGE.height - 19);
}

function drawSideLabel(doc, label) {
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.7);
  doc.line(198, 65, 198, 262);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(...COLORS.gold);
  doc.text(label, 201, 178, { angle: 90, align: "center" });
}

function prepareContinuationPage(doc) {
  doc.addPage();
  drawTopBand(doc);
  drawSideLabel(doc, "RED SKY GROUP PRIVATE AVIATION");
}

function drawContactFooter(doc) {
  const leftX = 14;
  const rightX = PAGE.width - 14;
  const lineY = 274.5;
  const phoneY = 279.5;
  const contactY = 286.5;

  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.35);
  doc.line(leftX, lineY, rightX, lineY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.steelSoft);
  doc.text(`Phone: ${CONTACT_DETAILS.phone}`, leftX, phoneY);

  doc.text("Email:", leftX, contactY);
  doc.setTextColor(...COLORS.steelSoft);
  doc.text(CONTACT_DETAILS.email, leftX + 12.5, contactY);

  doc.setTextColor(...COLORS.steelSoft);
  doc.text(" | Website:", leftX + 46, contactY);
  doc.setTextColor(...COLORS.steelSoft);
  doc.text(CONTACT_DETAILS.website, leftX + 65, contactY);
}

function addPageFooters(doc, startPage = 1, endPage = doc.getNumberOfPages()) {
  const pageCount = Math.max(endPage - startPage + 1, 0);

  if (!pageCount) return;

  for (let i = startPage; i <= endPage; i += 1) {
    doc.setPage(i);
    drawContactFooter(doc);
    drawPageFrame(doc);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.steelSoft);
    doc.text(`Page ${i - startPage + 1} of ${pageCount}`, PAGE.width - 11, 279.5, {
      align: "right",
    });
  }

  doc.setTextColor(...COLORS.ink);
}

function drawSectionTitle(doc, title, x, y) {
  doc.setFillColor(...COLORS.gold);
  doc.roundedRect(x, y - 3.5, 2.1, 7, 0.8, 0.8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, x + 5, y + 1);
}

function drawInfoCard(doc, title, rows, x, y, width, height) {
  doc.setFillColor(...COLORS.gold);
  doc.rect(x, y - 1.8, width, 1.8, "F");
  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(x, y, width, height, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  doc.text(title, x + 6, y + 8.5);

  let rowY = y + 17;
  rows.forEach((row) => {
    const usedLines = row?.type === "inline-metrics"
      ? drawInlineMetricsRow(
          doc,
          row.items,
          x + 6,
          rowY,
          width - 12,
        )
      : drawTextPair(doc, row[0], row[1], x + 6, rowY, width - 12);
    rowY += 6.5 + usedLines * 3.2;
  });
}

function addLogo(doc, logo, x, y, width) {
  const sourceWidth = Number(logo?.naturalWidth || logo?.width || 0);
  const sourceHeight = Number(logo?.naturalHeight || logo?.height || 0);
  const isImageElement = typeof logo?.complete === "boolean";

  if ((isImageElement && !logo.complete) || sourceWidth === 0 || sourceHeight === 0) return;

  const ratio = sourceHeight / sourceWidth;
  const height = width * ratio;
  const format = getImageFormat(logo);
  doc.addImage(logo, format, x, y, width, height);
}

function addLogoWithOpacity(doc, logo, x, y, width, opacity = 1) {
  const canUseOpacity =
    Number.isFinite(opacity) &&
    opacity > 0 &&
    opacity < 1 &&
    typeof doc?.GState === "function" &&
    typeof doc?.setGState === "function";

  if (!canUseOpacity) {
    addLogo(doc, logo, x, y, width);
    return;
  }

  doc.saveGraphicsState();
  doc.setGState(new doc.GState({ opacity }));
  addLogo(doc, logo, x, y, width);
  doc.restoreGraphicsState();
}

function getImageFormat(image) {
  const source = String(image?.currentSrc || image?.src || "").toLowerCase();
  return source.endsWith(".jpg") || source.endsWith(".jpeg") ? "JPEG" : "PNG";
}

async function loadImageAsset(src) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;

  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  });

  return img;
}

function trimTransparentImageAsset(image) {
  const width = Number(image?.naturalWidth || image?.width || 0);
  const height = Number(image?.naturalHeight || image?.height || 0);

  if (!width || !height || typeof document === "undefined") return image;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;

  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) return image;

  sourceContext.drawImage(image, 0, 0, width, height);
  const { data } = sourceContext.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 8) continue;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return image;

  const trimmedWidth = maxX - minX + 1;
  const trimmedHeight = maxY - minY + 1;
  const trimmedCanvas = document.createElement("canvas");
  trimmedCanvas.width = trimmedWidth;
  trimmedCanvas.height = trimmedHeight;

  const trimmedContext = trimmedCanvas.getContext("2d");
  if (!trimmedContext) return image;

  trimmedContext.drawImage(
    sourceCanvas,
    minX,
    minY,
    trimmedWidth,
    trimmedHeight,
    0,
    0,
    trimmedWidth,
    trimmedHeight,
  );

  return trimmedCanvas;
}

function drawCompactQuoteHeader(doc, logo, quote, { includeContract = true } = {}) {
  const headerX = 20;
  const headerY = 19;
  const headerWidth = 170;
  const headerHeight = 22;
  const logoWidth = 40;
  const appendixTitleY = 15.5;
  const titleX = 65;

  if (includeContract) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...COLORS.ink);
    doc.text("APPENDIX A - QUOTE", PAGE.width / 2, appendixTitleY, { align: "center" });
  }

  addLogo(doc, logo, headerX, headerY + 4.2, logoWidth);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.ink);
  doc.text("Executive Flight Quote", titleX, headerY + 13.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.steel);
  doc.text("Professional Private Aviation", titleX, headerY + 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  const reservationDate = quote?.departure_at || quote?.created_at || new Date();
  doc.text(`Reservation • ${formatDocumentDate(reservationDate)}`, 190, headerY + 14, {
    align: "right",
  });

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.35);
  doc.line(headerX, headerY + headerHeight + 6.5, headerX + headerWidth, headerY + headerHeight + 6.5);

  return headerY + headerHeight + 6.5;
}

function drawContractBrand(doc, logo) {
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.35);
  doc.line(15, 17, PAGE.width - 15, 17);
  addLogo(doc, logo, 14.5, 12, 34);
}

function drawContractWatermark(doc, redAccentLogo) {
  addLogoWithOpacity(doc, redAccentLogo, 65, 92, 80, 0.035);
}

function drawTermsPageHeader(doc, redAccentLogo, { showTitle = false } = {}) {
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  drawContractWatermark(doc, redAccentLogo);
  drawContractBrand(doc, redAccentLogo);

  if (showTitle) {
    doc.setFont("times", "bold");
    doc.setFontSize(15);
    doc.setTextColor(32, 36, 43);
    if (typeof doc.setCharSpace === "function") {
      doc.setCharSpace(0.12);
    }
    doc.text("AGREEMENT TO CHARTER", PAGE.width / 2, 37.5, {
      align: "center",
    });
    doc.text("AIRCRAFT CAPACITY", PAGE.width / 2, 44.2, {
      align: "center",
    });
    if (typeof doc.setCharSpace === "function") {
      doc.setCharSpace(0);
    }
  }
}

function parseInlineBold(text) {
  const segments = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }

  return segments.length ? segments : [{ text, bold: false }];
}

function normalizeInlineMarkdown(text) {
  return String(text || "").replace(/\*\*/g, "").trimEnd();
}

function parseContractBlocks(source) {
  return String(source || "")
    .split("\n")
    .map((rawLine) => rawLine.replace(/\r/g, ""))
    .reduce((blocks, line) => {
      const trimmed = line.trim();
      const rawText = line.replace(/\s+$/g, "");

      if (!trimmed) {
        blocks.push({ type: "spacer", height: 3.2 });
        return blocks;
      }

      if (/^###\s+/.test(trimmed)) {
        blocks.push({
          type: "heading3",
          text: normalizeInlineMarkdown(trimmed.replace(/^###\s+/, "")),
        });
        return blocks;
      }

      if (/^##\s+/.test(trimmed)) {
        blocks.push({
          type: "heading2",
          text: normalizeInlineMarkdown(trimmed.replace(/^##\s+/, "")),
        });
        return blocks;
      }

      if (/^#\s+/.test(trimmed)) {
        blocks.push({
          type: "heading1",
          text: normalizeInlineMarkdown(trimmed.replace(/^#\s+/, "")),
        });
        return blocks;
      }

      blocks.push({
        type: "paragraph",
        text: rawText,
        segments: parseInlineBold(rawText),
      });
      return blocks;
    }, []);
}

function getContractTermsSource(value = new Date()) {
  return CONTRACT_TERMS_SOURCE.replaceAll(
    CONTRACT_DATE_TOKEN,
    formatContractLongDate(value),
  );
}

function wrapRichTextLine(doc, segments, maxWidth, fontSize) {
  const lines = [];
  let currentLine = [];
  let currentWidth = 0;
  let pendingSpaceWidth = 0;

  const pushCurrentLine = () => {
    lines.push(currentLine);
    currentLine = [];
    currentWidth = 0;
    pendingSpaceWidth = 0;
  };

  segments.forEach((segment) => {
    const parts = segment.text.split(/(\s+)/).filter((part) => part.length);

    parts.forEach((part) => {
      doc.setFont("times", segment.bold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      const isWhitespace = /^\s+$/.test(part);

      if (isWhitespace) {
        pendingSpaceWidth = doc.getTextWidth(" ");
        return;
      }

      const partWidth = doc.getTextWidth(part);
      const tokenWidth = partWidth + (currentLine.length ? pendingSpaceWidth : 0);

      if (!currentLine.length) {
        currentLine.push({ text: part, bold: segment.bold, spaceBefore: 0 });
        currentWidth = partWidth;
        pendingSpaceWidth = 0;
        return;
      }

      if (currentWidth + tokenWidth > maxWidth) {
        pushCurrentLine();
        currentLine.push({ text: part, bold: segment.bold, spaceBefore: 0 });
        currentWidth = partWidth;
        pendingSpaceWidth = 0;
        return;
      }

      currentLine.push({ text: part, bold: segment.bold, spaceBefore: pendingSpaceWidth });
      currentWidth += tokenWidth;
      pendingSpaceWidth = 0;
    });
  });

  if (currentLine.length) pushCurrentLine();
  return lines.length ? lines : [[{ text: "", bold: false, spaceBefore: 0 }]];
}

function ensureTermsSpace(doc, state, heightNeeded, redAccentLogo) {
  const maxY = 264;
  if (state.y + heightNeeded <= maxY) return;

  doc.addPage();
  drawTermsPageHeader(doc, redAccentLogo);
  state.y = 45;
}

function getContractParagraphLayout(doc, segments, textWidth) {
  const lines = wrapRichTextLine(doc, segments, textWidth, 9);
  const lineHeight = 4.35;
  const blockHeight = lines.length * lineHeight + 0.8;

  return { lines, lineHeight, blockHeight };
}

function getMinimumParagraphHeight(doc, block, textWidth) {
  if (!block || block.type !== "paragraph") return 0;
  return getContractParagraphLayout(doc, block.segments, textWidth).blockHeight;
}

function renderRichTextLines(doc, lines, x, y, fontSize, lineHeight, color) {
  doc.setTextColor(...color);
  lines.forEach((line, index) => {
    let cursorX = x;
    line.forEach((segment) => {
      doc.setFont("times", segment.bold ? "bold" : "normal");
      doc.setFontSize(fontSize);
      cursorX += Number(segment.spaceBefore || 0);
      doc.text(segment.text, cursorX, y + index * lineHeight);
      cursorX += doc.getTextWidth(segment.text);
    });
  });
}

function renderContractTerms(doc, redAccentLogo) {
  const blocks = parseContractBlocks(getContractTermsSource(new Date()));
  const state = { y: 70 };
  const textX = 26;
  const textWidth = 158;
  let skippedPrimaryTitle = false;

  blocks.forEach((block, index) => {
    const nextBlock = blocks[index + 1] || null;

    if (!skippedPrimaryTitle && block.type === "heading1") {
      skippedPrimaryTitle = true;
      return;
    }

    if (block.type === "spacer") {
      state.y += 2.2;
      return;
    }

    if (block.type === "heading1") {
      ensureTermsSpace(doc, state, 9.8 + Math.min(getMinimumParagraphHeight(doc, nextBlock, textWidth), 10), redAccentLogo);
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.setTextColor(32, 36, 43);
      doc.text(block.text, textX, state.y);
      state.y += 6;
      return;
    }

    if (block.type === "heading2") {
      ensureTermsSpace(
        doc,
        state,
        9.2 + Math.min(getMinimumParagraphHeight(doc, nextBlock, textWidth), 14),
        redAccentLogo,
      );
      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.setTextColor(32, 36, 43);
      doc.text(block.text, textX, state.y);
      state.y += 6;
      return;
    }

    if (block.type === "heading3") {
      const extraSignatureGap = /THE CHARTERER/i.test(block.text) ? 5 : 0;
      ensureTermsSpace(
        doc,
        state,
        8.4 + extraSignatureGap + Math.min(getMinimumParagraphHeight(doc, nextBlock, textWidth), 11),
        redAccentLogo,
      );
      state.y += extraSignatureGap;
      doc.setFont("times", "bold");
      doc.setFontSize(9.2);
      doc.setTextColor(32, 36, 43);
      doc.text(block.text, textX, state.y);
      state.y += /RED AVIATION COMPANY, S\.A\. DE C\.V\./i.test(block.text) ? 7.5 : 6.5;
      return;
    }

    const { lines, lineHeight, blockHeight } = getContractParagraphLayout(
      doc,
      block.segments,
      textWidth,
    );
    ensureTermsSpace(doc, state, blockHeight, redAccentLogo);
    renderRichTextLines(doc, lines, textX, state.y, 9, lineHeight, COLORS.inkSoft);
    state.y += blockHeight;
  });

  return state;
}

function drawPaymentDetailsPage(doc, paymentLogo) {
  doc.addPage();
  doc.setFillColor(...COLORS.white);
  doc.rect(0, 0, PAGE.width, PAGE.height, "F");
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.35);
  doc.line(15, 17, PAGE.width - 15, 17);
  addLogoWithOpacity(doc, paymentLogo, 78, 108, 54, 0.03);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.ink);
  doc.text("APPENDIX B - PAYMENT DETAILS AND INSTRUCTIONS", PAGE.width / 2, 27, {
    align: "center",
  });

  const startX = 18;
  const endX = 192;
  const dividerX = 103;
  const labelX = 34;
  const valueX = 106;
  const bulletX = 28;
  const topY = 60;
  const rowHeight = 25.5;

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.35);
  doc.roundedRect(18, topY - 8, 174, rowHeight * PAYMENT_DETAILS.length + 15, 3, 3, "S");

  doc.setDrawColor(...COLORS.red);
  doc.setLineWidth(0.35);
  doc.line(dividerX, topY - 2, dividerX, topY - 2 + rowHeight * PAYMENT_DETAILS.length);

  PAYMENT_DETAILS.forEach(([label, value], index) => {
    const rowTopY = topY + index * rowHeight;
    const rowCenterY = rowTopY + 8.25;

    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.3);
    doc.line(startX, rowTopY + 13.3, endX, rowTopY + 13.3);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(15);
    doc.setTextColor(...COLORS.redDeep);
    doc.text(">", bulletX, rowCenterY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...COLORS.ink);
    doc.text(label, labelX, rowCenterY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(value, 78);
    doc.text(lines, valueX, rowCenterY);
  });

  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.3);
  doc.line(startX, topY + rowHeight * PAYMENT_DETAILS.length + 13.3, endX, topY + rowHeight * PAYMENT_DETAILS.length + 13.3);
  drawPageFrame(doc);
}

async function loadLogo() {
  const image = await loadImageAsset(`${import.meta.env.BASE_URL}images/logossinfondo.png`);
  return trimTransparentImageAsset(image);
}

async function loadPaymentLogo() {
  return loadImageAsset(`${import.meta.env.BASE_URL}images/logossinfondo.png`);
}

export async function generateFlightQuotePdf(quote, options = {}) {
  const { includeContract = true } = options;
  const doc = new jsPDF({ compress: true });
  const customerRoutes = Array.isArray(quote?.quote_routes) ? quote.quote_routes : [];
  const routes = getPdfLegs(quote);
  const clientRoutes = routes.filter((route) => !route?.positioning);
  const routeMetrics = await getPdfLegMetricsMap(quote, routes);
  const firstRoute = isSavedFlightQuote(quote)
    ? routes[0] || {}
    : getPrimaryQuoteRoute(quote) || {};
  const lastRoute = isSavedFlightQuote(quote)
    ? routes[routes.length - 1] || firstRoute
    : getFinalQuoteRoute(quote) || firstRoute;
  const firstClientRoute = clientRoutes[0] || firstRoute;
  const lastClientRoute = clientRoutes[clientRoutes.length - 1] || lastRoute;
  const aircraftName = await getQuoteAircraftName(quote, firstRoute);
  const commercialPresentation = buildQuoteCommercialBreakdownPresentation(
    quote,
    customerRoutes,
  );
  const costRows = commercialPresentation.displayRows;
  const total = commercialPresentation.displayTotal;
  const exchangeRate = Number(quote?.exchange_rate || 0);
  const totalMxn =
    Number(quote?.total_mxn || 0) || (exchangeRate > 0 ? Number((total * exchangeRate).toFixed(2)) : 0);
  const showMxnInPdf = Boolean(quote?.calculation_snapshot?.show_mxn_in_pdf);
  const logo = await loadLogo();
  const paymentLogo = includeContract ? await loadPaymentLogo() : null;

  drawTopBand(doc);
  const headerBottomY = drawCompactQuoteHeader(doc, logo, quote, { includeContract });

  const clientRows = [
    ["Name", quote?.full_name || quote?.client_name || "-"],
    ["Email", quote?.email || quote?.client_email || "-"],
    ["Phone", quote?.phone || quote?.client_phone || "-"],
  ];
  const passengerCount = Number(firstRoute?.passengers ?? quote?.passengers ?? 0);
  const departureDateValue = formatProfileDateTime(
    quote?.departure_at || firstClientRoute?.start_date,
  );
  const endDateValue = formatProfileDateTime(
    quote?.return_at || lastClientRoute?.end_date,
  );
  const isRoundTrip =
    clientRoutes.length > 1 &&
    String(firstClientRoute?.from_airport || "").trim().toUpperCase() ===
      String(lastClientRoute?.to_airport || "").trim().toUpperCase();
  const shouldShowEndDate =
    endDateValue !== "-" &&
    endDateValue !== departureDateValue &&
    clientRoutes.length > 1;
  const timelineItems = [
    {
      label: "Departure Date",
      value: departureDateValue,
    },
    shouldShowEndDate
      ? {
          label: isRoundTrip ? "Return Date" : "End Date",
          value: endDateValue,
        }
      : null,
    passengerCount > 0
      ? {
          label: "Passengers",
          value: String(passengerCount),
        }
      : null,
  ].filter(Boolean);
  const profileRows = [
    ["Aircraft", aircraftName],
    ["Route", getQuoteRoutePath(quote)],
    timelineItems.length ? { type: "inline-metrics", items: timelineItems } : null,
  ].filter(Boolean);

  const infoCardsY = headerBottomY + 4.5;
  const infoCardHeight = Math.max(
    getInfoCardHeight(doc, clientRows, 82),
    getInfoCardHeight(doc, profileRows, 82),
  );
  drawInfoCard(doc, "Client Information", clientRows, 20, infoCardsY, 82, infoCardHeight);
  drawInfoCard(doc, "Trip Profile", profileRows, 108, infoCardsY, 82, infoCardHeight);

  let y = infoCardsY + infoCardHeight + 3.5;

  drawSectionTitle(doc, "Flight Legs", 20, y);
  y += 9;

  doc.setFillColor(...COLORS.accentSoft);
  doc.roundedRect(20, y, 170, 8.5, 2, 2, "F");
  doc.setTextColor(...COLORS.navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.text("#", 25, y + 5.6);
  doc.text("TYPE", 38, y + 5.6);
  doc.text("DEPARTURE", 60, y + 5.6);
  doc.text("ARRIVAL", 111, y + 5.6);
  doc.text("DIST (NM)", 157, y + 5.6, { align: "center" });
  doc.text("TIME", 178, y + 5.6, { align: "center" });
  y += 8.5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.ink);

  if (!routes.length) {
    doc.setFillColor(...COLORS.row);
    doc.rect(20, y, 170, 10, "F");
    doc.setFontSize(7.5);
    doc.text("No flight legs were registered for this quote.", 25, y + 6);
    y += 10;
  } else {
    routes.forEach((route, index) => {
      const departureAirport = getAirportDisplay(
        route?.from_airport,
        route?.from_airport_name,
      );
      const arrivalAirport = getAirportDisplay(
        route?.to_airport,
        route?.to_airport_name,
      );
      const typeLabel = route?.positioning
        ? route?.positioningLabel || "Repositioning"
        : "Client leg";
      const fromName = doc.splitTextToSize(departureAirport.name, 42);
      const fromDetail = departureAirport.detail
        ? doc.splitTextToSize(departureAirport.detail, 42)
        : [];
      const toName = doc.splitTextToSize(arrivalAirport.name, 40);
      const toDetail = arrivalAirport.detail
        ? doc.splitTextToSize(arrivalAirport.detail, 40)
        : [];
      const metrics = routeMetrics[getLegMetricKey(route, index)] || {};
      const rowLineHeight = 2.7;
      const fromLineCount = fromName.length + fromDetail.length;
      const toLineCount = toName.length + toDetail.length;
      const rowHeight = Math.max(9, Math.max(fromLineCount, toLineCount) * rowLineHeight + 3);

      if (index % 2 === 0) {
        doc.setFillColor(...COLORS.row);
        doc.rect(20, y, 170, rowHeight, "F");
      }

      if (route?.positioning) {
        doc.setFillColor(254, 243, 199);
        doc.rect(33, y + 1.6, 20, rowHeight - 3.2, "F");
      }

      doc.setFontSize(5.25);
      doc.text(String(index + 1), 25, y + 4.6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(4.7);
      doc.setTextColor(...(route?.positioning ? [154, 52, 18] : COLORS.steel));
      doc.text(doc.splitTextToSize(typeLabel.toUpperCase(), 18), 43, y + rowHeight / 2, {
        align: "center",
        baseline: "middle",
        lineHeightFactor: 0.95,
      });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(...COLORS.ink);
      doc.text(fromName, 60, y + 4.2, { lineHeightFactor: 0.95 });
      doc.text(toName, 111, y + 4.2, { lineHeightFactor: 0.95 });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.1);
      doc.setTextColor(...COLORS.steel);
      const fromDetailY = y + 4.2 + fromName.length * rowLineHeight;
      const toDetailY = y + 4.2 + toName.length * rowLineHeight;
      if (fromDetail.length) doc.text(fromDetail, 60, fromDetailY, { lineHeightFactor: 0.95 });
      if (toDetail.length) doc.text(toDetail, 111, toDetailY, { lineHeightFactor: 0.95 });

      doc.setTextColor(...COLORS.ink);
      doc.setFontSize(5.5);
      doc.text(formatPdfDistance(metrics.distanceLabel), 157, y + rowHeight / 2 + 1, { align: "center" });
      doc.text(formatPdfTime(metrics.durationLabel), 178, y + rowHeight / 2 + 1, { align: "center" });

      doc.setDrawColor(...COLORS.line);
      doc.line(20, y + rowHeight, 190, y + rowHeight);
      y += rowHeight;
    });
  }

  const breakdownHeight = 13 + costRows.length * 5.8;
  const totalBlockHeight = showMxnInPdf && exchangeRate > 0 ? 28 : 20;
  const breakdownBlockHeight = 9 + breakdownHeight;

  y += 7;

  if (y + breakdownBlockHeight > FIRST_PAGE_CONTENT_MAX_Y) {
    prepareContinuationPage(doc);
    y = 28;
  }

  drawSectionTitle(doc, "Commercial Breakdown", 20, y);
  y += 9;

  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.panel);
  doc.roundedRect(20, y, 170, breakdownHeight, 4, 4, "FD");
  doc.setFillColor(...COLORS.accentSoft);
  doc.roundedRect(24, y + 4.5, 162, 8.5, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  doc.setTextColor(...COLORS.navy);
  doc.text("DESCRIPTION", 29, y + 9.9);
  doc.text("AMOUNT", 180, y + 9.9, { align: "right" });

  let rowY = y + 17;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(...COLORS.ink);

  costRows.forEach((row, index) => {
    if (index % 2 === 1) {
      doc.setFillColor(...COLORS.white);
      doc.rect(24, rowY - 4.1, 162, 5.8, "F");
    }

    doc.setFont("helvetica", "normal");
    doc.text(row.label, 29, rowY);
    doc.setFont("helvetica", "bold");
    doc.text(formatMoney(row.displayValue), 180, rowY, { align: "right" });
    rowY += 5.8;
  });

  y += breakdownHeight + 9;

  if (y + totalBlockHeight > FIRST_PAGE_CONTENT_MAX_Y) {
    prepareContinuationPage(doc);
    y = 28;
  }

  doc.setFillColor(...COLORS.gold);
  doc.rect(20, y - 2, 170, 2, "F");
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(20, y, 170, totalBlockHeight, 3, 3, "F");
  doc.setFillColor(37, 57, 79);
  doc.roundedRect(137, y + 4, 48, 10.5, 2.5, 2.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.8);
  doc.setTextColor(...COLORS.white);
  doc.text("SUMMARY", 26, y + 5.4);
  doc.setFontSize(8.6);
  doc.text("TOTAL ESTIMATED BALANCE", 26, y + 10.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.9);
  doc.text("Estimated in USD, subject to itinerary confirmation", 26, y + 16.2);
  doc.setFontSize(11.8);
  doc.setFont("helvetica", "bold");
  doc.text(`${formatMoney(total)} USD`, 181.5, y + 11.3, { align: "right" });
  if (showMxnInPdf && exchangeRate > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.8);
    doc.text(`${formatMoney(totalMxn)} MXN`, 181.5, y + 20.6, {
      align: "right",
    });
  }

  if (includeContract && paymentLogo) {
    drawPaymentDetailsPage(doc, paymentLogo);
    doc.addPage();
    drawTermsPageHeader(doc, paymentLogo, { showTitle: true });
    renderContractTerms(doc, paymentLogo);
  }
  addPageFooters(doc, 1, doc.getNumberOfPages());
  return doc;
}
