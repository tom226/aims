/**
 * Generate a sequential document number like PO-2026-0001
 */
async function generateDocNumber(prisma, prefix, field, model) {
  const year = new Date().getFullYear();
  const prefix_year = `${prefix}-${year}-`;

  // Find the last record with this year prefix
  const records = await prisma[model].findMany({
    where: { [field]: { startsWith: prefix_year } },
    orderBy: { [field]: 'desc' },
    take: 1,
    select: { [field]: true },
  });

  let nextNum = 1;
  if (records.length > 0) {
    const lastNum = parseInt(records[0][field].split('-').pop(), 10);
    nextNum = lastNum + 1;
  }

  return `${prefix_year}${String(nextNum).padStart(4, '0')}`;
}

/**
 * Generate a GPO number in financial-year format: GPO / 26 - 27 / 0001
 * Financial year runs April–March.
 */
async function generateGPONumber(prisma) {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-based
  const year = now.getFullYear();
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;
  const fyStr = `${String(fyStart).slice(2)} - ${String(fyEnd).slice(2)}`;
  const searchPrefix = `GPO / ${fyStr} /`;

  const records = await prisma.purchaseOrder.findMany({
    where: { poNumber: { startsWith: searchPrefix } },
    orderBy: { poNumber: 'desc' },
    take: 1,
    select: { poNumber: true },
  });

  let nextNum = 1;
  if (records.length > 0) {
    const parts = records[0].poNumber.split('/');
    const lastNum = parseInt(parts[parts.length - 1].trim(), 10);
    if (!isNaN(lastNum)) nextNum = lastNum + 1;
  }

  return `GPO / ${fyStr} / ${String(nextNum).padStart(4, '0')}`;
}

module.exports = { generateDocNumber, generateGPONumber };
