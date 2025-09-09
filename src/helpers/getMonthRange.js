

export const getMonthRange = (month, year) => {
    const startDate = new Date(year, month - 1, 1); // Primer día del mes
    const endDate = new Date(year, month, 0); // Último día del mes

    return { startDate, endDate }
}