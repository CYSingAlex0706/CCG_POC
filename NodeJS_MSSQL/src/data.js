'use strict';

/**
 * Reference data for the demo.
 *
 * Property names / addresses / facts below are taken from the public pages of
 * Chinachem Group (https://www.chinachemgroup.com/ and the for-sale listing).
 * Prices and sale documents are DEMO DATA for the APM demonstration only.
 */

const PROPERTIES = [
  {
    id: 'zendo-house',
    name: 'ZENDO HOUSE',
    nameZh: '瑜意',
    tagline: 'Motion in Emotion',
    category: 'sale',
    type: 'Residential',
    address: '8 Tak Hing Street, Tsim Sha Tsui, Kowloon',
    district: 'Tsim Sha Tsui',
    details: 'Studio – 2 bedrooms · ~1 min walk to Jordan MTR Station',
    schoolNet: '—',
    status: 'selling',
  },
  {
    id: 'echo-house',
    name: 'ECHO HOUSE',
    nameZh: '映日灣',
    tagline: 'Living experience is brand new here',
    category: 'sale',
    type: 'Residential',
    address: '28 Tonkin Street, Cheung Sha Wan, Kowloon',
    district: 'Cheung Sha Wan',
    details: '1 – 3 bedrooms · Heart of West Kowloon',
    schoolNet: '—',
    status: 'selling',
  },
  {
    id: 'in-one',
    name: 'IN ONE',
    nameZh: 'ONE 何文田',
    tagline: 'Timeless residences atop MTR Ho Man Tin Station',
    category: 'sale',
    type: 'Residential',
    address: '1 Chung Hau Street, Ho Man Tin, Kowloon',
    district: 'Ho Man Tin',
    details: '1 – 4 bedrooms · Atop MTR Ho Man Tin Station',
    schoolNet: '34',
    status: 'selling',
  },
  {
    id: 'the-redhill-peninsula-b',
    name: 'The Redhill Peninsula – Site B',
    nameZh: '紅山半島 B 地盤',
    tagline: 'Traditional luxury house district',
    category: 'sale',
    type: 'Residential',
    address: '18 Pak Pat Shan Road, Tai Tam, Hong Kong',
    district: 'Tai Tam',
    details: 'Seaview with high level of privacy',
    schoolNet: '18',
    status: 'selling',
  },
  {
    id: 'the-redhill-peninsula-c',
    name: 'The Redhill Peninsula – Site C',
    nameZh: '紅山半島 C 地盤',
    tagline: 'Traditional luxury house district',
    category: 'sale',
    type: 'Residential',
    address: '18 Pak Pat Shan Road, Tai Tam, Hong Kong',
    district: 'Tai Tam',
    details: 'Seaview with high level of privacy',
    schoolNet: '18',
    status: 'selling',
  },
  {
    id: 'university-heights',
    name: 'University Heights',
    nameZh: '大學閣',
    tagline: 'At the Peak of Mid-Levels Living',
    category: 'sale',
    type: 'Residential',
    address: '42 Kotewall Road, Mid-Levels, Hong Kong',
    district: 'Mid-Levels',
    details: '75 elegant units · 1,515 – 3,237 sq.ft · 3 – 4 bedrooms',
    schoolNet: '11',
    status: 'selling',
  },
  {
    id: 'victoria-coast',
    name: 'Victoria Coast',
    nameZh: '維港灣畔',
    tagline: 'A new iconic seaview residence in Pok Fu Lam',
    category: 'sale',
    type: 'Residential',
    address: 'No. 301 Victoria Road, Pok Fu Lam, Hong Kong',
    district: 'Pok Fu Lam',
    details: '1,356 – 1,367 sq.ft · 2 – 3 bedrooms · Sandy Bay seaview',
    schoolNet: '18',
    status: 'selling',
  },
  {
    id: 'whitesand-cove',
    name: 'WHITESAND COVE',
    nameZh: '白沙灣',
    tagline: 'Sensory dockside living',
    category: 'sale',
    type: 'Residential',
    address: '162 Hiram’s Highway, Hebe Haven, New Territories',
    district: 'Hebe Haven',
    details: '3 – 5 bedrooms · Low-density villas and apartments',
    schoolNet: '—',
    status: 'selling',
  },
];

const DOCUMENTS = [
  { id: 1, reference: 'SD-2026-0001', property_address: '8 Tak Hing Street, Tsim Sha Tsui', city: 'Kowloon', property_type: 'apartment', price: 24500000, sale_date: '2026-01-12', status: 'signed', document_type: '臨時買賣合約 / Preliminary Agreement', updated_at: '2026-01-12T09:24:11.000Z', property_id: 'zendo-house' },
  { id: 2, reference: 'SD-2026-0002', property_address: '28 Tonkin Street, Cheung Sha Wan', city: 'Kowloon', property_type: 'apartment', price: 12800000, sale_date: '2026-01-28', status: 'pending', document_type: '正式買賣合約 / Formal Agreement', updated_at: '2026-01-28T14:02:33.000Z', property_id: 'echo-house' },
  { id: 3, reference: 'SD-2026-0003', property_address: '1 Chung Hau Street, Ho Man Tin', city: 'Kowloon', property_type: 'apartment', price: 18650000, sale_date: '2026-02-03', status: 'completed', document_type: '轉讓契 / Assignment', updated_at: '2026-02-03T11:40:00.000Z', property_id: 'in-one' },
  { id: 4, reference: 'SD-2026-0004', property_address: '18 Pak Pat Shan Road, Tai Tam', city: 'Hong Kong', property_type: 'house', price: 62000000, sale_date: '2026-02-14', status: 'draft', document_type: '售樓說明書 / Sales Brochure', updated_at: '2026-02-14T08:15:42.000Z', property_id: 'the-redhill-peninsula-b' },
  { id: 5, reference: 'SD-2026-0005', property_address: '42 Kotewall Road, Mid-Levels', city: 'Hong Kong', property_type: 'apartment', price: 39800000, sale_date: '2026-02-20', status: 'signed', document_type: '價單 / Price List', updated_at: '2026-02-20T16:55:19.000Z', property_id: 'university-heights' },
  { id: 6, reference: 'SD-2026-0006', property_address: 'No. 301 Victoria Road, Pok Fu Lam', city: 'Hong Kong', property_type: 'apartment', price: 21700000, sale_date: '2026-03-02', status: 'pending', document_type: '臨時買賣合約 / Preliminary Agreement', updated_at: '2026-03-02T10:07:07.000Z', property_id: 'victoria-coast' },
  { id: 7, reference: 'SD-2026-0007', property_address: '162 Hiram’s Highway, Hebe Haven', city: 'New Territories', property_type: 'house', price: 47500000, sale_date: '2026-03-11', status: 'completed', document_type: '轉讓契 / Assignment', updated_at: '2026-03-11T13:31:58.000Z', property_id: 'whitesand-cove' },
  { id: 8, reference: 'SD-2026-0008', property_address: '18 Pak Pat Shan Road, Tai Tam', city: 'Hong Kong', property_type: 'house', price: 58900000, sale_date: '2026-03-19', status: 'cancelled', document_type: '正式買賣合約 / Formal Agreement', updated_at: '2026-03-19T09:48:26.000Z', property_id: 'the-redhill-peninsula-c' },
];

// Keep the shape produced by the original SQL query for backwards compatibility.
const DOCUMENT_COLUMNS = [
  'id', 'reference', 'property_address', 'city', 'property_type',
  'price', 'sale_date', 'status', 'document_type', 'updated_at',
];

module.exports = { PROPERTIES, DOCUMENTS, DOCUMENT_COLUMNS };
