/** The 24 provinces of Cambodia (Phnom Penh is its own delivery area). */
export const PROVINCES: { en: string; km: string }[] = [
  { en: "Banteay Meanchey", km: "បន្ទាយមានជ័យ" }, { en: "Battambang", km: "បាត់ដំបង" }, { en: "Kampong Cham", km: "កំពង់ចាម" },
  { en: "Kampong Chhnang", km: "កំពង់ឆ្នាំង" }, { en: "Kampong Speu", km: "កំពង់ស្ពឺ" }, { en: "Kampong Thom", km: "កំពង់ធំ" },
  { en: "Kampot", km: "កំពត" }, { en: "Kandal", km: "កណ្ដាល" }, { en: "Kep", km: "កែប" }, { en: "Koh Kong", km: "កោះកុង" },
  { en: "Kratie", km: "ក្រចេះ" }, { en: "Mondulkiri", km: "មណ្ឌលគិរី" }, { en: "Oddar Meanchey", km: "ឧត្តរមានជ័យ" },
  { en: "Pailin", km: "ប៉ៃលិន" }, { en: "Preah Sihanouk", km: "ព្រះសីហនុ" }, { en: "Preah Vihear", km: "ព្រះវិហារ" },
  { en: "Prey Veng", km: "ព្រៃវែង" }, { en: "Pursat", km: "ពោធិ៍សាត់" }, { en: "Ratanakiri", km: "រតនគិរី" },
  { en: "Siem Reap", km: "សៀមរាប" }, { en: "Stung Treng", km: "ស្ទឹងត្រែង" }, { en: "Svay Rieng", km: "ស្វាយរៀង" },
  { en: "Takeo", km: "តាកែវ" }, { en: "Tbong Khmum", km: "ត្បូងឃ្មុំ" },
];
export const PROVINCE_NAMES = PROVINCES.map((p) => p.en) as [string, ...string[]];
