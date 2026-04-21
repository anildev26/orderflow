import type { Workbook, Worksheet, CellValue } from 'exceljs';
import { STATUS_OPTIONS, MEDIATOR_NAMES, REVIEWER_NAMES, OrderStatus, OrderPlatform } from '@/types/order';
import type { GlobalPlatform } from '@/store/usePlatformStore';

const ORDER_TYPES = ['Rating', 'Review', 'Empty Box'];
const YES_NO = ['Yes', 'No'];

// Column definitions — single source of truth for header, hint, width, type, required, dropdown source.
export interface TemplateColumn {
  key: string;
  header: string;
  hint: string;
  width: number;
  required: boolean;
  type: 'text' | 'email' | 'url' | 'date' | 'number' | 'dropdown' | 'yesno';
  source?: string; // for dropdown: range name in Options sheet
  example?: string;
}

function buildColumns(platformLabels: string[]): TemplateColumn[] {
  return [
    { key: 'orderId', header: 'Order ID', hint: 'Platform order ID. Must be unique — duplicates will be rejected.', width: 22, required: true, type: 'text', example: 'OD123456789' },
    { key: 'platform', header: 'Platform', hint: `Choose one: ${platformLabels.join(', ')}`, width: 14, required: true, type: 'dropdown', source: 'Platforms' },
    { key: 'email', header: 'Email', hint: 'Email you used to fill the order form for this product.', width: 28, required: true, type: 'email', example: 'you@example.com' },
    { key: 'brandName', header: 'Brand Name', hint: 'Brand name (optional).', width: 18, required: false, type: 'text' },
    { key: 'productName', header: 'Product Name', hint: 'Name of the product ordered.', width: 30, required: true, type: 'text' },
    { key: 'orderDate', header: 'Order Date', hint: 'Date the order was placed. Use the date format — click the cell and pick a date.', width: 14, required: true, type: 'date' },
    { key: 'totalAmount', header: 'Total Amount (INR)', hint: 'Total order amount in rupees.', width: 16, required: true, type: 'number', example: '1299' },
    { key: 'sellerLess', header: 'Seller Less (INR)', hint: 'Your actual cost after seller discount / refund (0 if none).', width: 16, required: false, type: 'number' },
    { key: 'orderType', header: 'Deal Type', hint: `Choose one: ${ORDER_TYPES.join(', ')}`, width: 14, required: true, type: 'dropdown', source: 'DealTypes' },
    { key: 'status', header: 'Order Status', hint: 'Leave blank to default to "Ordered". Pick a later status if this is an old / completed order.', width: 22, required: false, type: 'dropdown', source: 'Statuses' },
    { key: 'mediatorName', header: 'Mediator Name', hint: 'Pick from list, or choose "Other" and write the name in Mediator Message.', width: 22, required: false, type: 'dropdown', source: 'Mediators' },
    { key: 'reviewerName', header: 'Reviewer Name', hint: `Choose one: ${REVIEWER_NAMES.join(', ')}`, width: 20, required: false, type: 'dropdown', source: 'Reviewers' },
    { key: 'isReplacement', header: 'Is Replacement?', hint: 'Yes if this order replaces an earlier one.', width: 14, required: false, type: 'yesno' },
    { key: 'replacementOrderId', header: 'Replacement Order ID', hint: 'The original Order ID that this one replaces (only if Is Replacement = Yes).', width: 22, required: false, type: 'text' },
    { key: 'isExchange', header: 'Is Exchange?', hint: 'Yes if this was an exchange order.', width: 14, required: false, type: 'yesno' },
    { key: 'exchangeProductName', header: 'Exchange Product Name', hint: 'Product exchanged for (only if Is Exchange = Yes).', width: 26, required: false, type: 'text' },
    { key: 'mediatorMessage', header: 'Mediator Message', hint: 'Any message or note from/to the mediator.', width: 32, required: false, type: 'text' },
    { key: 'refundFormLink', header: 'Refund Form Link', hint: 'Link to refund form (https://...).', width: 32, required: false, type: 'url' },
    { key: 'deliveredDate', header: 'Delivered Date', hint: 'Date the order was delivered (only if Status is Delivered or later).', width: 14, required: false, type: 'date' },
    { key: 'returnPeriodDays', header: 'Return Period (Days)', hint: 'Return window in days (defaults to 7 if blank).', width: 14, required: false, type: 'number' },
    { key: 'reviewRatingDate', header: 'Review/Rating Date', hint: 'Date review/rating was submitted.', width: 14, required: false, type: 'date' },
    { key: 'refundFormFilledDate', header: 'Refund Form Filled Date', hint: 'Date the refund form was submitted.', width: 16, required: false, type: 'date' },
    { key: 'informedMediatorDate', header: 'Informed Mediator Date', hint: 'Date you informed the mediator.', width: 16, required: false, type: 'date' },
    { key: 'paymentReceivedDate', header: 'Payment Received Date', hint: 'Date payment was received.', width: 16, required: false, type: 'date' },
    { key: 'paymentBank', header: 'Payment Bank', hint: 'Bank that received the payment.', width: 16, required: false, type: 'text' },
  ];
}

export interface TemplateOptions {
  platforms: GlobalPlatform[];
}

export async function buildTemplateWorkbook({ platforms }: TemplateOptions): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'OrderFlow';
  wb.created = new Date();

  const activePlatforms = platforms.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const platformLabels = activePlatforms.map((p) => p.label);
  const columns = buildColumns(platformLabels);

  // --- Options sheet (hidden) holds list values for data validations ---
  const optionsSheet = wb.addWorksheet('Options', { state: 'veryHidden' });
  const optionLists: Array<{ name: string; values: string[] }> = [
    { name: 'Platforms', values: platformLabels.length ? platformLabels : ['Flipkart', 'Amazon', 'Myntra', 'Meesho'] },
    { name: 'DealTypes', values: ORDER_TYPES },
    { name: 'Statuses', values: STATUS_OPTIONS.map((s) => s.label) },
    { name: 'Mediators', values: MEDIATOR_NAMES },
    { name: 'Reviewers', values: REVIEWER_NAMES },
    { name: 'YesNo', values: YES_NO },
  ];

  let col = 1;
  const rangeByName: Record<string, string> = {};
  optionLists.forEach((list) => {
    const letter = optionsSheet.getColumn(col).letter;
    optionsSheet.getCell(`${letter}1`).value = list.name;
    optionsSheet.getCell(`${letter}1`).font = { bold: true };
    list.values.forEach((v, i) => {
      optionsSheet.getCell(`${letter}${i + 2}`).value = v;
    });
    rangeByName[list.name] = `Options!$${letter}$2:$${letter}$${list.values.length + 1}`;
    col += 1;
  });

  // --- Instructions sheet ---
  const instructionsSheet = wb.addWorksheet('Instructions');
  instructionsSheet.getColumn(1).width = 28;
  instructionsSheet.getColumn(2).width = 14;
  instructionsSheet.getColumn(3).width = 70;

  instructionsSheet.mergeCells('A1:C1');
  const title = instructionsSheet.getCell('A1');
  title.value = 'OrderFlow — Order Import Template';
  title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
  instructionsSheet.getRow(1).height = 28;

  instructionsSheet.mergeCells('A2:C2');
  const sub = instructionsSheet.getCell('A2');
  sub.value = 'Fill orders in the "Orders" sheet. One row per order. Do not rename or reorder columns.';
  sub.font = { italic: true, color: { argb: 'FF555555' } };
  sub.alignment = { horizontal: 'center' };
  instructionsSheet.getRow(2).height = 20;

  const headerRow = instructionsSheet.getRow(4);
  headerRow.values = ['Column', 'Required?', 'How to fill'];
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } } };
  });

  columns.forEach((c, i) => {
    const row = instructionsSheet.getRow(5 + i);
    row.values = [c.header, c.required ? 'Required' : 'Optional', c.hint];
    if (c.required) row.getCell(2).font = { color: { argb: 'FFDC2626' }, bold: true };
    row.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    row.height = Math.max(18, Math.ceil(c.hint.length / 70) * 16);
  });

  const notesRowIdx = 5 + columns.length + 2;
  instructionsSheet.mergeCells(`A${notesRowIdx}:C${notesRowIdx}`);
  const notesTitle = instructionsSheet.getCell(`A${notesRowIdx}`);
  notesTitle.value = 'Notes';
  notesTitle.font = { bold: true, size: 13 };

  const notes = [
    'Dates must be entered as real dates (click the cell, then pick from the calendar or type DD/MM/YYYY).',
    'Amounts are numbers only — no currency symbols, no commas.',
    'Dropdown columns show a small arrow; pick from the list so spelling matches the app exactly.',
    'Duplicate Order IDs will be rejected on import. Each order ID must be unique in your account.',
    'You can leave the first empty sample row in place — blank rows are ignored on import.',
    'Only new orders are created on import; existing orders are never overwritten.',
  ];
  notes.forEach((n, i) => {
    const r = instructionsSheet.getRow(notesRowIdx + 1 + i);
    r.getCell(1).value = '•';
    r.getCell(1).alignment = { horizontal: 'right', vertical: 'top' };
    instructionsSheet.mergeCells(`B${notesRowIdx + 1 + i}:C${notesRowIdx + 1 + i}`);
    r.getCell(2).value = n;
    r.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    r.height = 18;
  });

  // --- Orders sheet ---
  const orders = wb.addWorksheet('Orders', { views: [{ state: 'frozen', ySplit: 2 }] });

  // Header row
  const header = orders.getRow(1);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.required ? `${c.header} *` : c.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF3B82F6' } },
      right: { style: 'thin', color: { argb: 'FF374151' } },
    };
    orders.getColumn(i + 1).width = c.width;
  });
  header.height = 32;

  // Hint row (row 2)
  const hint = orders.getRow(2);
  columns.forEach((c, i) => {
    const cell = hint.getCell(i + 1);
    cell.value = c.hint;
    cell.font = { size: 9, italic: true, color: { argb: 'FF6B7280' } };
    cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
  });
  hint.height = 54;

  // Example row (row 3) — sample values to show users the shape
  const example = orders.getRow(3);
  const exampleValues: Record<string, unknown> = {
    orderId: 'OD123456789',
    platform: platformLabels[0] || 'Flipkart',
    email: 'you@example.com',
    brandName: 'ACME',
    productName: 'Sample Product',
    orderDate: new Date(),
    totalAmount: 1299,
    sellerLess: 0,
    orderType: 'Rating',
    status: 'Ordered',
    mediatorName: 'Other',
    reviewerName: 'Other',
    isReplacement: 'No',
    isExchange: 'No',
    returnPeriodDays: 7,
  };
  columns.forEach((c, i) => {
    const cell = example.getCell(i + 1);
    if (exampleValues[c.key] !== undefined) cell.value = exampleValues[c.key] as CellValue;
    cell.font = { italic: true, color: { argb: 'FF9CA3AF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    if (c.type === 'date') cell.numFmt = 'dd-mmm-yyyy';
    if (c.type === 'number') cell.numFmt = '#,##0';
  });
  example.height = 18;
  orders.getCell('A3').note = 'This row is a sample. You can delete it or type over it.';

  // Add data validation + formatting to empty rows (rows 4..503 → 500 rows capacity)
  const DATA_START = 4;
  const DATA_END = 503;
  applyColumnFormatting(orders, columns, rangeByName, DATA_START, DATA_END);

  return wb;
}

function applyColumnFormatting(
  sheet: Worksheet,
  columns: TemplateColumn[],
  rangeByName: Record<string, string>,
  startRow: number,
  endRow: number,
) {
  // The exceljs runtime exposes `worksheet.dataValidations.add(ref, model)`,
  // but the published types don't include it. Cast once for this helper.
  const validations = (sheet as unknown as {
    dataValidations: { add: (ref: string, model: Record<string, unknown>) => void };
  }).dataValidations;

  columns.forEach((c, i) => {
    const colLetter = sheet.getColumn(i + 1).letter;
    const colRef = `${colLetter}${startRow}:${colLetter}${endRow}`;

    // Number format for the column
    if (c.type === 'date') {
      for (let r = startRow; r <= endRow; r++) {
        sheet.getCell(`${colLetter}${r}`).numFmt = 'dd-mmm-yyyy';
      }
    } else if (c.type === 'number') {
      for (let r = startRow; r <= endRow; r++) {
        sheet.getCell(`${colLetter}${r}`).numFmt = '#,##0.##';
      }
    }

    // Data validation
    if (c.type === 'dropdown' && c.source) {
      validations.add(colRef, {
        type: 'list',
        allowBlank: !c.required,
        formulae: [rangeByName[c.source]],
        showErrorMessage: true,
        errorTitle: 'Invalid value',
        error: `Pick a value from the dropdown for ${c.header}.`,
      });
    } else if (c.type === 'yesno') {
      validations.add(colRef, {
        type: 'list',
        allowBlank: true,
        formulae: [rangeByName['YesNo']],
      });
    } else if (c.type === 'date') {
      validations.add(colRef, {
        type: 'date',
        allowBlank: !c.required,
        operator: 'greaterThan',
        formulae: [new Date(2000, 0, 1)],
        showErrorMessage: true,
        errorTitle: 'Invalid date',
        error: 'Enter a valid date (e.g. 15-Apr-2026).',
      });
    } else if (c.type === 'number') {
      validations.add(colRef, {
        type: 'decimal',
        allowBlank: !c.required,
        operator: 'greaterThanOrEqual',
        formulae: [0],
        showErrorMessage: true,
        errorTitle: 'Invalid number',
        error: 'Enter a non-negative number.',
      });
    }
  });
}

// ---------------------------------------------------------------------------
// PARSER
// ---------------------------------------------------------------------------

export interface ParsedOrderRow {
  orderId: string;
  platform: OrderPlatform;
  email: string;
  brandName: string;
  productName: string;
  orderDate: string;
  totalAmount: number;
  sellerLess: number;
  orderType: string;
  status: OrderStatus;
  mediatorName: string;
  reviewerName: string;
  isReplacement: boolean;
  replacementOrderId: string;
  isExchange: boolean;
  exchangeProductName: string;
  mediatorMessage: string;
  refundFormLink?: string;
  deliveredDate?: string;
  returnPeriodDays?: number;
  reviewRatingDate?: string;
  refundFormFilledDate?: string;
  informedMediatorDate?: string;
  paymentReceivedDate?: string;
  paymentBank?: string;
}

export interface ParseResult {
  orders: ParsedOrderRow[];
  errors: string[];
}

function toIsoDate(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return undefined;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  if (!s) return undefined;
  // Try native parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
  return isNaN(n) ? undefined : n;
}

function cellText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as { text: unknown }).text ?? '').trim();
  }
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return String((value as { result: unknown }).result ?? '').trim();
  }
  if (typeof value === 'object' && value !== null && 'richText' in value) {
    const rt = (value as { richText: Array<{ text: string }> }).richText;
    return rt.map((r) => r.text).join('').trim();
  }
  return String(value).trim();
}

function yesNo(value: unknown): boolean {
  const s = cellText(value).toLowerCase();
  return s === 'yes' || s === 'y' || s === 'true';
}

export async function parseTemplateFile(
  file: File,
  platforms: GlobalPlatform[],
): Promise<ParseResult> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);

  const sheet = wb.getWorksheet('Orders') || wb.worksheets[0];
  if (!sheet) return { orders: [], errors: ['No Orders sheet found in file.'] };

  const activePlatforms = platforms.filter((p) => p.active);
  const platformByLabel = new Map<string, OrderPlatform>();
  activePlatforms.forEach((p) => platformByLabel.set(p.label.toLowerCase(), p.value as OrderPlatform));

  const statusByLabel = new Map<string, OrderStatus>();
  STATUS_OPTIONS.forEach((s) => statusByLabel.set(s.label.toLowerCase(), s.value));

  const orders: ParsedOrderRow[] = [];
  const errors: string[] = [];
  const seenIds = new Set<string>();

  // Row 1 header, row 2 hint, row 3 example → data starts row 4, but we also tolerate row 3 if user overwrote the example.
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell.value).replace(/\s*\*\s*$/, '').trim();
  });

  // Map header name → column index
  const col = (name: string) => {
    const idx = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    return idx > 0 ? idx : -1;
  };

  const cols = {
    orderId: col('Order ID'),
    platform: col('Platform'),
    email: col('Email'),
    brandName: col('Brand Name'),
    productName: col('Product Name'),
    orderDate: col('Order Date'),
    totalAmount: col('Total Amount (INR)'),
    sellerLess: col('Seller Less (INR)'),
    orderType: col('Deal Type'),
    status: col('Order Status'),
    mediatorName: col('Mediator Name'),
    reviewerName: col('Reviewer Name'),
    isReplacement: col('Is Replacement?'),
    replacementOrderId: col('Replacement Order ID'),
    isExchange: col('Is Exchange?'),
    exchangeProductName: col('Exchange Product Name'),
    mediatorMessage: col('Mediator Message'),
    refundFormLink: col('Refund Form Link'),
    deliveredDate: col('Delivered Date'),
    returnPeriodDays: col('Return Period (Days)'),
    reviewRatingDate: col('Review/Rating Date'),
    refundFormFilledDate: col('Refund Form Filled Date'),
    informedMediatorDate: col('Informed Mediator Date'),
    paymentReceivedDate: col('Payment Received Date'),
    paymentBank: col('Payment Bank'),
  };

  const missingCols: string[] = [];
  Object.entries(cols).forEach(([k, v]) => { if (v < 0) missingCols.push(k); });
  if (cols.orderId < 0 || cols.platform < 0 || cols.email < 0 || cols.productName < 0 || cols.orderDate < 0 || cols.totalAmount < 0 || cols.orderType < 0) {
    errors.push(`Template is missing required columns: ${missingCols.join(', ')}. Please download a fresh template.`);
    return { orders, errors };
  }

  for (let r = 3; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const orderId = cellText(row.getCell(cols.orderId).value);
    // Skip the sample row (italic placeholder) and empty rows
    if (!orderId) continue;
    if (orderId === 'OD123456789') continue;

    const rowLabel = `Row ${r}`;

    // Email
    const email = cellText(row.getCell(cols.email).value);
    if (!email) { errors.push(`${rowLabel}: Email is required.`); continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors.push(`${rowLabel}: Email "${email}" is invalid.`); continue; }

    // Platform
    const platformLabel = cellText(row.getCell(cols.platform).value);
    if (!platformLabel) { errors.push(`${rowLabel}: Platform is required.`); continue; }
    const platform = platformByLabel.get(platformLabel.toLowerCase());
    if (!platform) {
      const valid = activePlatforms.map((p) => p.label).join(', ');
      errors.push(`${rowLabel}: Platform "${platformLabel}" is not recognized. Pick one of: ${valid}.`);
      continue;
    }

    // Product name
    const productName = cellText(row.getCell(cols.productName).value);
    if (!productName) { errors.push(`${rowLabel}: Product Name is required.`); continue; }

    // Order date
    const orderDate = toIsoDate(row.getCell(cols.orderDate).value);
    if (!orderDate) { errors.push(`${rowLabel}: Order Date is required and must be a valid date.`); continue; }

    // Total amount
    const totalAmount = toNumber(row.getCell(cols.totalAmount).value);
    if (totalAmount == null) { errors.push(`${rowLabel}: Total Amount is required and must be a number.`); continue; }

    // Deal type
    const orderType = cellText(row.getCell(cols.orderType).value);
    if (!orderType) { errors.push(`${rowLabel}: Deal Type is required.`); continue; }
    if (!ORDER_TYPES.includes(orderType)) {
      errors.push(`${rowLabel}: Deal Type "${orderType}" is invalid. Pick one of: ${ORDER_TYPES.join(', ')}.`);
      continue;
    }

    // Status (default to 'ordered')
    const statusLabel = cellText(row.getCell(cols.status).value);
    let status: OrderStatus = 'ordered';
    if (statusLabel) {
      const mapped = statusByLabel.get(statusLabel.toLowerCase());
      if (!mapped) {
        errors.push(`${rowLabel}: Order Status "${statusLabel}" is not recognized.`);
        continue;
      }
      status = mapped;
    }

    // Duplicate check within the file
    if (seenIds.has(orderId)) {
      errors.push(`${rowLabel}: Order ID "${orderId}" appears more than once in the file.`);
      continue;
    }
    seenIds.add(orderId);

    const sellerLess = toNumber(row.getCell(cols.sellerLess).value) ?? 0;
    const mediatorName = cellText(row.getCell(cols.mediatorName).value);
    const reviewerName = cellText(row.getCell(cols.reviewerName).value);
    const isReplacement = yesNo(row.getCell(cols.isReplacement).value);
    const replacementOrderId = cellText(row.getCell(cols.replacementOrderId).value);
    const isExchange = yesNo(row.getCell(cols.isExchange).value);
    const exchangeProductName = cellText(row.getCell(cols.exchangeProductName).value);
    const mediatorMessage = cellText(row.getCell(cols.mediatorMessage).value);
    const refundFormLink = cellText(row.getCell(cols.refundFormLink).value);
    const brandName = cellText(row.getCell(cols.brandName).value);

    orders.push({
      orderId,
      platform,
      email,
      brandName,
      productName,
      orderDate,
      totalAmount,
      sellerLess,
      orderType,
      status,
      mediatorName,
      reviewerName,
      isReplacement,
      replacementOrderId: isReplacement ? replacementOrderId : '',
      isExchange,
      exchangeProductName: isExchange ? exchangeProductName : '',
      mediatorMessage,
      refundFormLink: refundFormLink || undefined,
      deliveredDate: toIsoDate(row.getCell(cols.deliveredDate).value),
      returnPeriodDays: toNumber(row.getCell(cols.returnPeriodDays).value),
      reviewRatingDate: toIsoDate(row.getCell(cols.reviewRatingDate).value),
      refundFormFilledDate: toIsoDate(row.getCell(cols.refundFormFilledDate).value),
      informedMediatorDate: toIsoDate(row.getCell(cols.informedMediatorDate).value),
      paymentReceivedDate: toIsoDate(row.getCell(cols.paymentReceivedDate).value),
      paymentBank: cellText(row.getCell(cols.paymentBank).value) || undefined,
    });
  }

  return { orders, errors };
}

// Download helper — used by the UI.
export async function downloadOrderTemplate(platforms: GlobalPlatform[]): Promise<void> {
  const wb = await buildTemplateWorkbook({ platforms });
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `orderflow-template-${new Date().toISOString().split('T')[0]}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
