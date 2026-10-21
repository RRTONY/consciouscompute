export type ProtocolRow = { test: string; indicator: string; measured: string; instrument: string };

export const PROTOCOL: ProtocolRow[] = [
  { test: "Published", indicator: "P1 Energy and carbon", measured: "Operational carbon per unit of useful work, including embodied emissions", instrument: "Software Carbon Intensity, ISO/IEC 21031:2024" },
  { test: "Published", indicator: "P2 Water", measured: "Water withdrawn and consumed, on site and in electricity generation", instrument: "Method of Li et al. (2023); utility records" },
  { test: "Published", indicator: "P3 Local cost allocation", measured: "Who pays for grid upgrades, rate effects, land, noise and traffic, disclosed before approval", instrument: "Filed tariff and interconnection documents; public disclosure record" },
  { test: "Shared", indicator: "S1 Formula", measured: "Stated percentage or formula of revenue or appreciation to the community", instrument: "The contract" },
  { test: "Shared", indicator: "S2 Enforceability", measured: "Escrow, covenant or remedy if the share is not paid", instrument: "Legal review of the instrument" },
  { test: "Shared", indicator: "S3 Voice", measured: "Rung reached on Arnstein's ladder: informed, consulted, or partnership", instrument: "Governance documents; community survey" },
  { test: "Checked", indicator: "C1 Independence", measured: "Verifier has no financial stake in the outcome", instrument: "Conflict disclosure" },
  { test: "Checked", indicator: "C2 Frequency and openness", measured: "Interval of verification and whether results are public", instrument: "Published reports" },
  { test: "Checked", indicator: "C3 Consequence", measured: "Defined, graduated response to failure, after Ostrom's sanctions principle", instrument: "The contract and the enforcement record" },
];

export type UseCase = { title: string; measure: string; passes: string };

export const USE_CASES: UseCase[] = [
  {
    title: "Use case 1. A county weighs a campus.",
    measure: "Measure: P1 to P3 as a one-page public scorecard filed before the vote, S1 to S3 as term-sheet commitments, C1 to C3 as the named verifier and reporting calendar.",
    passes: "Passes if: the scorecard is public before approval, the community share is in the approval conditions, and the named verifier independently confirms both the published figures and delivery of the share on the stated calendar. Failure looks like: numbers released after the vote, a share described as intent, or no independent check.",
  },
  {
    title: "Use case 2. An AI training run.",
    measure: "Measure: SCI per training run and water per run, reported alongside the model documentation in the manner of model cards (Mitchell et al., 2019), with location and time of compute stated because carbon intensity varies by both.",
    passes: "Passes if: the run's energy, carbon and water are published with method and the host community of the data hall is named, that community holds a defined, enforceable share under the data hall's terms, and an independent party verifies both the figures and delivery of the share. Publishing the figures alone is not a pass. Failure looks like a single average figure with no site.",
  },
  {
    title: "Use case 3. An enterprise buys capacity.",
    measure: "Measure: the nine indicators as procurement criteria in a data center request for proposal, scored on the same 0 to 3 scale for each bidder.",
    passes: "Passes if: the buyer can compare bidders on community terms the way it compares them on price and latency, and the winning contract requires all three commitments: published costs, a defined, enforceable community share, and independent verification of both. Comparing disclosures alone is not a pass. A buyer's reputation then no longer rides on a supplier's silence.",
  },
];

export const TOKEN_CASE: UseCase = {
  title: "A tokenized cultural asset.",
  measure: "Measure: at ImpactSoul, each issuance would record the infrastructure cost (P1 to P3), the percentage of appreciation returned to the community that creates the asset's value (S1 and S2), and an independent attestation of delivery (C1 to C3).",
  passes: "Passes if: the costs are published, the community that drives value holds a defined, enforceable part of it, and an independent party attests that the share was delivered. Failure looks like impact described in the prospectus and absent from the contract.",
};

export type LineageRow = { date: string; evidence: string; shows: string };

export const LINEAGE: LineageRow[] = [
  { date: "2017 to 2018", evidence: "Zero Waste IT white paper, Draft 2.1 dated January 11, 2018", shows: "Conceptual ancestor: shared capacity, zero waste" },
  { date: "August 27, 2019", evidence: "Email, subject \"Fusechain: appreciating your continued support\"", shows: "Earliest located written use of eco-conscious compute; references ZWIT and the iMasons network" },
  { date: "January 26, 2021", evidence: "Email to a colleague proposing a panel on eco-conscious compute", shows: "Second written use" },
  { date: "February 18, 2023", evidence: "Domain registration for consciouscompute.net", shows: "First located instance of the exact phrase" },
  { date: "October 13, 2026", evidence: "Publication at ConsciousCompute.org", shows: "Public, dated claim" },
];

export type Reference = { text: string; link?: { href: string; label: string } };

export const REFERENCES: Reference[] = [
  { text: "Arnstein, S. R. (1969). A ladder of citizen participation. Journal of the American Institute of Planners, 35(4), 216 to 224." },
  { text: "Elkington, J. (1997). Cannibals with Forks: The Triple Bottom Line of 21st Century Business. Capstone." },
  { text: "Freeman, R. E. (1984). Strategic Management: A Stakeholder Approach. Pitman." },
  { text: "Green Software Foundation. Software Carbon Intensity specification, adopted as ISO/IEC 21031:2024.", link: { href: "https://greensoftware.foundation/stories/sci-measurement/", label: "greensoftware.foundation" } },
  { text: "Hardin, G. (1968). The tragedy of the commons. Science, 162(3859), 1243 to 1248." },
  { text: "Li, P., Yang, J., Islam, M. A., and Ren, S. (2023). Making AI less \"thirsty\": Uncovering and addressing the secret water footprint of AI models. arXiv preprint 2304.03271.", link: { href: "https://arxiv.org/abs/2304.03271", label: "arxiv.org/abs/2304.03271" } },
  { text: "Mitchell, M., et al. (2019). Model cards for model reporting. Proceedings of FAT* 2019. arXiv 1810.03993.", link: { href: "https://arxiv.org/abs/1810.03993", label: "arxiv.org/abs/1810.03993" } },
  { text: "Ostrom, E. (1990). Governing the Commons: The Evolution of Institutions for Collective Action. Cambridge University Press." },
  { text: "Shehabi, A., et al. (2024). 2024 United States Data Center Energy Usage Report. Lawrence Berkeley National Laboratory, LBNL-2001637.", link: { href: "https://eta-publications.lbl.gov/publications/2024-lbnl-data-center-energy-usage-report", label: "eta-publications.lbl.gov" } },
  { text: "Strubell, E., Ganesh, A., and McCallum, A. (2019). Energy and policy considerations for deep learning in NLP. Proceedings of ACL 2019, P19-1355.", link: { href: "https://aclanthology.org/P19-1355/", label: "aclanthology.org/P19-1355" } },
  { text: "Wheal, J., and Kotler, S. (2017). Stealing Fire: How Silicon Valley, the Navy SEALs, and Maverick Scientists Are Revolutionizing the Way We Live and Work. Dey Street Books." },
  { text: "Greenberg, T. (2018). Zero Waste IT: The Ride-Sharing Service of IT. White paper, Draft 2.1, January 11, 2018. Unpublished." },
];
