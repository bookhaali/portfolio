/* Research data for the Lab (research.html). Citations from Crossref. */
window.RS = {
  papers: [
    { id: 'oby', year: 2026, journal: 'Obesity', short: 'Obesity in early and later adulthood, 196 countries',
      title: 'Trends of Obesity in Early Adulthood and Later Adulthood Across 196 Countries and Territories, 1990-2022',
      authors: ['Ali AM', 'Giovannucci E', 'Liu JJ'], where: '2026;34(10):1979-1988', doi: '10.1002/oby.70290', first: true,
      method: 'Segmented regression · NCD-RisC · R', topic: 'Obesity',
      about: 'Obesity prevalence in adults aged 20-49 and 50 and over in 196 countries and territories, 1990-2022, with segmented-regression trend estimates for each country.',
      extra: { label: 'See every country', href: 'obesity-2026.html' } },
    { id: 'puh', year: 2026, journal: 'Public Health', short: 'Khat chewing and oral and esophageal cancer',
      title: 'Khat chewing and its association with oral/esophageal squamous cell carcinoma and oral white lesions: A systematic review and meta-analysis',
      authors: ['Ali AM', 'Huang N', 'Liu JJ'], where: '2026;252:106177', doi: '10.1016/j.puhe.2026.106177', first: true,
      method: 'Systematic review · meta-analysis', topic: 'Cancer',
      about: 'A systematic review and meta-analysis of khat chewing and the risk of oral and esophageal squamous cell carcinoma and oral white lesions.' },
    { id: 'bct', year: 2026, journal: 'Blood Cell Therapy', short: 'Return to work after stem cell transplantation',
      title: 'Return to Work After Hematopoietic Stem Cell Transplantation: A Longitudinal Analysis of Fatigue and Organ-Specific Chronic Graft-versus-Host Disease',
      authors: ['Chiang MK', 'Hsiao YM', 'Ali AM', 'Tan TD', 'Chiou LW'], where: '2026;9(3):114-124', doi: '10.31547/bct-2026-007', first: false,
      method: 'Longitudinal analysis', topic: 'Clinical',
      about: 'A longitudinal analysis of how fatigue and chronic graft-versus-host disease in specific organs relate to return to work after stem cell transplantation.' },
    { id: 'eca', year: 2025, journal: 'ecancermedicalscience', short: 'Khat and upper digestive tract cancers in Hargeisa',
      title: 'Relationship between Khat chewing and upper digestive tract cancers among male patients in Hargeisa: case control study',
      authors: ['Ali AM', 'Mutuku MN', 'Hashi A', 'Muhumed OM'], where: '2025;19:1880', doi: '10.3332/ecancer.2025.1880', first: true,
      method: 'Case-control study', topic: 'Cancer',
      about: 'A case-control study of khat chewing and cancers of the upper digestive tract among male patients in Hargeisa.' }
  ],
  studies: [
    { label: 'Study 01', title: 'Child and adolescent obesity', about: 'Global trends by sex and age band, 1990-2024.', method: 'AAPC trends · NCD-RisC', status: 'In preparation' },
    { label: 'Study 02', title: 'Global diet quality', about: 'Dietary trends across age groups, 1990-2018.', method: 'Diet indices · trend analysis', status: 'In preparation' },
    { label: 'Study 03', title: 'Obesity-related cancers', about: 'Incidence and mortality trends in relation to obesity, by country and sex.', method: 'Joinpoint · GBD', status: 'In preparation' },
    { label: 'Study 04', title: 'Obesity in Africa', about: 'Trends across the continent and three age groups.', method: 'AAPC trends · maps', status: 'In preparation' },
    { label: 'Study 06', title: 'Non-communicable diseases in East Africa', about: 'A scoping review mapping the evidence.', method: 'PRISMA-ScR', status: 'Under review' }
  ],
  field: [
    { year: 2026, journal: 'International Dental Journal', where: '2026;76(5):109766', doi: '10.1016/j.identj.2026.109766',
      title: 'Association of Higher Caries Levels With Reduced Oral Health-Related Quality of Life Among Somali School Children in Hargeisa' },
    { year: 2024, fieldwork: 2022, journal: 'Community Dentistry and Oral Epidemiology', where: '2024;52(6):861-870', doi: '10.1111/cdoe.12990',
      title: 'Dental caries status and related factors among 12-year-old Somali school children in Hargeisa' }
  ],
  covexe: { name: 'Covexe', url: 'https://covexe.com', about: 'One browser platform for the whole systematic review, from protocol to publication figures. Every extracted value cites the sentence it came from, and the statistics run on your own machine.' },
  methods: ['R', 'Python', 'Stata', 'SQL', 'Joinpoint regression', 'AAPC trends', 'Meta-analysis', 'Systematic and scoping review', 'Survival analysis', 'ggplot2'],
  doiUrl: d => 'https://doi.org/' + d,
  authorHTML: p => p.authors.map(a => a === 'Ali AM' ? '<b>Ali AM</b>' : a).join(', ')
};
