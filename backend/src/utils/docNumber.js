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

module.exports = { generateDocNumber };
