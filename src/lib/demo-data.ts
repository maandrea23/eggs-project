import { format, subDays } from "date-fns";
import type { FarmState } from "./types";

const isoDay = (date: Date) => format(date, "yyyy-MM-dd");

export function createDemoFarmState(): FarmState {
  const today = new Date();
  const eggLogs = Array.from({ length: 21 }, (_, index) => {
    const daysAgo = 20 - index;
    const date = subDays(today, daysAgo);
    const wave = Math.round(Math.sin(index / 2) * 5);

    return {
      id: `egg-${isoDay(date)}`,
      date: isoDay(date),
      coop1Eggs: 106 + wave + (index % 3),
      coop2Eggs: 98 - wave + (index % 4),
      crackedEggs: index % 5 === 0 ? 5 : 2,
      notes: index === 20 ? "Normal collection. Coop 2 belt checked." : "",
      synced: true,
      createdAt: date.toISOString(),
    };
  });

  return {
    coops: [
      {
        id: "coop-1",
        name: "Coop 1",
        capacity: 130,
        hens: 126,
        chicks: 0,
        notes: "Automated nest boxes and water line.",
      },
      {
        id: "coop-2",
        name: "Coop 2",
        capacity: 130,
        hens: 124,
        chicks: 0,
        notes: "Check conveyor belt every Friday.",
      },
    ],
    birdMovements: [
      {
        id: "move-1",
        date: isoDay(subDays(today, 15)),
        coopId: "coop-1",
        type: "new_birds",
        quantity: 6,
        notes: "Replacement layers added.",
      },
    ],
    eggLogs,
    sales: [
      {
        id: "sale-1",
        date: isoDay(subDays(today, 13)),
        cartons: 24,
        pricePerCartonCop: 18500,
        customerName: "Tienda La Esquina",
      },
      {
        id: "sale-2",
        date: isoDay(subDays(today, 7)),
        cartons: 30,
        pricePerCartonCop: 19000,
        customerName: "Restaurante Central",
      },
      {
        id: "sale-3",
        date: isoDay(subDays(today, 2)),
        cartons: 18,
        pricePerCartonCop: 19000,
        customerName: "Ruta sabado",
      },
    ],
    feedPurchases: [
      {
        id: "feed-purchase-1",
        date: isoDay(subDays(today, 18)),
        feedType: "Layer mash",
        quantityKg: 420,
        priceCop: 1020000,
        supplier: "Agroinsumos Norte",
      },
      {
        id: "feed-purchase-2",
        date: isoDay(subDays(today, 5)),
        feedType: "Layer pellet",
        quantityKg: 300,
        priceCop: 780000,
        supplier: "Avicola Andina",
      },
    ],
    feedUsage: Array.from({ length: 14 }, (_, index) => ({
      id: `feed-use-${index}`,
      date: isoDay(subDays(today, 13 - index)),
      quantityKg: 29 + (index % 4),
      notes: index % 6 === 0 ? "Higher usage after refill." : "",
    })),
    expenses: [
      {
        id: "expense-1",
        date: isoDay(subDays(today, 10)),
        category: "packaging",
        amountCop: 145000,
        description: "Carton packaging sleeves",
      },
      {
        id: "expense-2",
        date: isoDay(subDays(today, 6)),
        category: "maintenance",
        amountCop: 220000,
        description: "Motor belt adjustment",
      },
      {
        id: "expense-3",
        date: isoDay(subDays(today, 3)),
        category: "cleaning",
        amountCop: 85000,
        description: "Disinfectant and gloves",
      },
    ],
    inventoryItems: [
      {
        id: "inv-feed",
        name: "Feed stock",
        category: "feed",
        quantity: 285,
        unit: "kg",
        reorderLevel: 90,
      },
      {
        id: "inv-medicine",
        name: "General medicine",
        category: "medicine",
        quantity: 4,
        unit: "bottles",
        reorderLevel: 2,
      },
      {
        id: "inv-vaccine",
        name: "Vaccines",
        category: "vaccines",
        quantity: 16,
        unit: "doses",
        reorderLevel: 20,
      },
      {
        id: "inv-cleaning",
        name: "Cleaning supplies",
        category: "cleaning",
        quantity: 8,
        unit: "items",
        reorderLevel: 4,
      },
      {
        id: "inv-packaging",
        name: "Carton packaging",
        category: "packaging",
        quantity: 120,
        unit: "cartons",
        reorderLevel: 40,
      },
    ],
    healthRecords: [
      {
        id: "health-1",
        date: isoDay(subDays(today, 4)),
        coopId: "coop-2",
        type: "sick",
        sickBirds: 2,
        notes: "Watched birds after heat stress.",
      },
      {
        id: "health-2",
        date: isoDay(subDays(today, 12)),
        coopId: "coop-1",
        type: "vaccination",
        notes: "Routine vaccine completed.",
      },
    ],
    maintenanceTasks: [
      {
        id: "task-1",
        title: "Clean egg belts",
        dueDate: isoDay(subDays(today, -1)),
        coopId: "coop-1",
        status: "open",
      },
      {
        id: "task-2",
        title: "Buy feed before weekend",
        dueDate: isoDay(subDays(today, 1)),
        status: "open",
      },
    ],
    offlineQueue: [],
  };
}
