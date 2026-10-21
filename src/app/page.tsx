import Image from "next/image";
import { ArrowRightIcon, AsterismIcon, DiamondIcon, ReferenceMarkIcon, SparkleIcon, WavyArrowIcon } from "@/components/icons";
import { LINEAGE, PROTOCOL, REFERENCES, TOKEN_CASE, USE_CASES, type UseCase } from "@/lib/paper";

const cell = "border-b border-rule px-2 py-2.5 text-left align-top";

function DataTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <>
      <div className="my-4 md:hidden">
        {rows.map((row) => (
          <dl key={row.join("|")} className="border-b border-rule py-3 text-[0.85rem] first:border-t">
            {row.map((value, i) => (
              <div key={head[i]} className="py-0.5">
                <dt className="inline font-semibold">{head[i]}: </dt>
                <dd className="inline">{value}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
      <table className="my-4 hidden w-full border-collapse text-[0.85rem] md:table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className={`${cell} bg-wash`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((value, i) => (
                <td key={i} className={cell}>
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function TestBox({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="my-4 border-2 border-ink bg-white px-4 py-3 sm:px-5 sm:py-4">
      <b className="font-serif text-[1.15rem]">{name}</b> {children}
    </div>
  );
}

function UseCaseCard({ c }: { c: UseCase }) {
  return (
    <div className="my-5 border border-l-4 border-rule border-l-rust bg-white px-4 py-3 sm:px-5 sm:py-4 sm:border-l-6">
      <p className="mb-1 text-[0.75rem] font-semibold tracking-[0.12em] text-rust uppercase">Illustrative, not a completed project</p>
      <b className="font-serif text-[1.15rem]">{c.title}</b>
      <p className="my-1.5">{c.measure}</p>
      <p className="my-1.5">{c.passes}</p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.88rem] text-mute">{children}</p>;
}

export default function Home() {
  return (
    <main className="mx-auto max-w-184 pt-6 pb-16 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] sm:pt-8 sm:pb-20 sm:pl-[max(24px,env(safe-area-inset-left))] sm:pr-[max(24px,env(safe-area-inset-right))]">
      <aside role="note" aria-label="Temporary placement" className="mb-6 border-4 border-notice-orange bg-white px-4 py-3 sm:px-5 sm:py-4 text-[0.9rem] sm:mb-8">
        <p className="mb-1 font-serif text-[1.3rem] font-bold text-rust sm:text-[1.5rem]">Temporary placement.</p>
        This page presents an early working draft of Conscious Compute for discussion and critique. The framework, scoring, and examples are provisional. No projects have yet been independently assessed under it.
      </aside>
      <p className="text-[0.8rem] font-semibold tracking-[0.12em] text-violet uppercase">
        ConsciousCompute.org · Working paper · October 13, 2026
      </p>
      <h1>The cloud has neighbors.</h1>
      <p className="text-[1.05rem] font-medium">
        Conscious Compute proposes three commitments for computing infrastructure: publish the local costs, share value with affected communities, and independently verify both.
      </p>
      <p className="text-[0.9rem] text-mute">Tony Greenberg · ImpactSoul · Draft for citation and critique</p>

      <figure className="my-6">
        <Image
          src="/image.svg"
          width={1200}
          height={820}
          priority
          className="block h-auto w-full border border-rule"
          alt="A violet data hall at the center of a ring of eleven neighborhood houses. An orange square on each line marks the cost of connecting. A twelfth house outside the ring has a dashed outline and no line."
        />
        <figcaption className="mt-2 text-[0.85rem] text-mute">
          The bargain, drawn. Eleven neighbors are connected and carry a cost. One is left out. Conscious compute is the discipline of counting all twelve.
        </figcaption>
      </figure>

      <h2>Abstract</h2>
      <p>This paper defines conscious compute as computing infrastructure whose operator publishes the cost it imposes on the surrounding community, shares a defined and enforceable portion of the value created, and submits both commitments to independent verification. It proposes a nine-indicator measurement protocol, built on existing standards and published research on energy, carbon and water, and describes three illustrative use cases in which the protocol could be applied: a county siting decision, an AI training run, and an enterprise procurement, with a tokenized cultural asset as an exploratory application. It traces the concept to the Zero Waste IT white paper of 2017 to 2018, to written use in August 2019, and to the exact phrase in a February 2023 domain registration. The protocol is a proposal. It has not yet been piloted, and the paper says plainly what would count as evidence against it.</p>

      <h2>1. The humane premise <SparkleIcon /></h2>
      <p>Every data hall has a neighbor. Somewhere within a few miles of the fans, someone drinks the same water, pays into the same grid, and hears the same hum. In most siting decisions that person learns the terms after they are fixed. The cost arrives as a rate change, a drought notice, or a truck route. The benefit arrives somewhere else.</p>
      <p>Conscious compute begins from a plain moral claim: the people who carry a cost are parties to the deal, not externalities of it. This is not sentiment. It draws on a long-standing finding in the study of shared resources, that arrangements tend to last when the people affected can see what is happening and have a say in it (Ostrom, 1990). Whether that holds for computing infrastructure, so that the humane position and the durable position are the same position, is one of the things the pilot will test.</p>

      <h2>2. The definition</h2>
      <div className="my-6 border-l-4 border-violet bg-wash px-4 py-3 sm:px-5 sm:py-4 font-medium sm:border-l-6">
        <DiamondIcon /> Conscious compute is computing infrastructure that measures success by more than uptime and return on investment, because the community around it is treated as a party to the deal. It is established by three tests: Published, Shared, and Checked.
      </div>
      <p>It is operational, since each clause can be audited. It is scale-free, applying to a hyperscale campus, a colocation cage, a model-training cluster, or a token whose value depends on a community&apos;s attention. And it is not a synonym for green computing. Green computing asks how much a workload consumes. Conscious compute asks who carries what remains and who receives what is made.</p>

      <h2>3. How it works: three tests</h2>
      <TestBox name="Published.">The operator discloses the cost of connecting before approval: energy and carbon, water, land, noise, and who pays for each, including grid upgrades and rate effects.</TestBox>
      <TestBox name="Shared.">A defined portion of upside is contractually directed to the affected community. Defined means a stated percentage or formula. Enforceable means a remedy exists if it is not paid.</TestBox>
      <TestBox name="Checked.">An independent party with no financial stake confirms that the published numbers are true and the shared portion was delivered, at a stated interval, with consequences for failure.</TestBox>
      <p>One test makes an operator transparent. Two make it generous. Three make it accountable. All three are required for the name, and until pilots validate the method, no project is awarded it.</p>

      <h2>4. Theoretical grounding</h2>
      <p>The Published and Checked tests descend from Ostrom (1990), whose comparative work on long-enduring commons found that monitoring, graduated sanctions and accessible conflict resolution distinguish arrangements that survive from those that collapse. The Shared test answers the dynamic Hardin (1968) described, where private gain from a shared resource outruns private responsibility for it. Stakeholder theory supplies the corporate bridge: Freeman (1984) argued that firms owe attention to those affected by their actions, and Elkington (1997) gave the argument an accounting form. The depth of the community&apos;s role borrows from Arnstein (1969), whose ladder of citizen participation separates real power from consultation theater.</p>
      <p>The empirical case for disclosure is now strong. Strubell, Ganesh and McCallum (2019) showed that training a single large language model can carry a substantial carbon cost, and Li, Yang, Islam and Ren (2023, preprint) estimated that training GPT-3 in Microsoft&apos;s U.S. data centers could directly evaporate about 700,000 liters of freshwater, and projected global AI-related water withdrawal of 4.2 to 6.6 billion cubic meters in 2027. The Lawrence Berkeley National Laboratory report (Shehabi et al., 2024) provides the national baseline for U.S. data center electricity demand and scenarios to 2028. These sources measure the machine. Conscious compute adds the question the sources do not ask: who pays, who shares, and who checks.</p>

      <h2>5. Measurement protocol <ArrowRightIcon /></h2>
      <p>Each test is scored on three indicators. Each indicator receives a level: 0 absent, 1 promised, 2 documented, 3 independently verified. The maximum score is 27.</p>
      <DataTable
        head={["Test", "Indicator", "What is measured", "Instrument"]}
        rows={PROTOCOL.map((r) => [r.test, r.indicator, r.measured, r.instrument])}
      />
      <div className="my-4 border-2 border-ink bg-wash px-4 py-3 sm:px-5 sm:py-4 font-semibold wrap-anywhere">
        Conscious Compute Index = sum of nine indicator levels, 0 to 27. The index reports assessment progress only. A numerical score alone cannot qualify a project: independent verification of the disclosures and of delivery of the community commitments is mandatory. Until pilots validate the method, assessments report progress and no project is awarded &ldquo;Conscious&rdquo; status.
      </div>
      <p>The Software Carbon Intensity specification expresses carbon as SCI = (E × I + M) per R, where E is energy, I the carbon intensity of that energy, M embodied emissions amortized over hardware life, and R a functional unit such as a transaction or an API call. Choosing R is the hard part, and the protocol requires the operator to publish its choice and defend it.</p>
      <Note>The level definitions and any qualifying threshold are proposed, not validated. A pilot should test inter-rater reliability, meaning whether two independent assessors score the same operator the same way, and whether a candidate threshold, such as at least 6 of 9 on each test with no indicator at 0, separates operators that communities themselves judge fair from those they do not.</Note>

      <h2>6. Use cases <WavyArrowIcon /></h2>
      <p>Each use case below is illustrative, not a completed project. To pass, a project must meet all three commitments: Published, Shared, and Checked. Disclosure alone is never a pass.</p>
      {USE_CASES.map((c) => (
        <UseCaseCard key={c.title} c={c} />
      ))}

      <h2>7. Limitations <ReferenceMarkIcon /></h2>
      <p>The protocol would be wrong if communities rate high-scoring operators no more fairly treated than low-scoring ones, or if operators can score well by gaming the choice of functional unit or verifier. Water and carbon figures vary by method, site and year, and the preprint cited here has not been confirmed as peer reviewed. Others use similar phrases, including sustainable computing and eco-conscious computing, in energy-efficiency contexts, and this paper claims a specific, testable meaning rather than those fields. Any claim to the phrase as a trademark is a separate matter for counsel, and nothing here is legal advice.</p>
      <p><AsterismIcon /> The cloud has neighbors. Conscious compute is the promise to act like it.</p>

      <h2>8. Help test this framework</h2>
      <p>We&apos;re seeking a small group of infrastructure operators, community representatives, buyers, and independent reviewers to help test this framework. Bring a project, challenge an assumption, or help design the first pilot.</p>

      <h2>9. Background and exploratory applications</h2>
      <p>The sections below are background to the framework, not part of it.</p>
      <h3>9.1 A note on consciousness</h3>
      <p>The word &ldquo;conscious&rdquo; is chosen on purpose. Jamie Wheal and Steven Kotler (2017) make the case in Stealing Fire that institutions already treat human attention and states of mind as a performance resource. If that is right, a data hall is where collective attention is physically processed, and the people who supplied it are owed more than a checkbox. The bridge is this author&apos;s reading, not a claim made by Wheal, and readers should check it against the book.</p>

      <h3>9.2 An exploratory application</h3>
      <p>Conscious compute is meant to be scale-free, so it may also apply beyond the data hall. The example below is exploratory.</p>
      <UseCaseCard c={TOKEN_CASE} />

      <h3>9.3 Lineage: from Zero Waste IT to conscious compute</h3>
      <p>The earliest documented ancestor is Zero Waste IT (ZWIT), a white paper circulated in draft in 2017 and 2018. The version preserved in the author&apos;s files, Draft 2.1 dated January 11, 2018, is titled &ldquo;Zero Waste IT: The Ride-Sharing Service of IT.&rdquo; Its argument was that idle IT capacity is waste, and that sharing capacity, as ride-sharing shares vehicles, removes it.</p>
      <p>ZWIT was a marketplace first and a conscience second, but the conscience was written down. The paper listed five social responsibility pillars: lower power consumption, reuse of hardware and facilities, nudging buyers toward more responsible suppliers by building carbon footprint and social responsibility scores into recommendations, a platform for lower-energy proof-of-stake networks, and transparency with data replacing salesmanship. Conscious compute keeps that instinct and moves the question. Zero Waste IT asked how to waste nothing in the machine. Conscious compute asks how to waste no one around it.</p>
      <DataTable head={["Date", "Evidence", "What it shows"]} rows={LINEAGE.map((r) => [r.date, r.evidence, r.shows])} />
      <Note>The author used the idea in conversation for over a decade before committing it to writing. These are the earliest located written records, not a claim that earlier writing does not exist. Mail before 2019 and several accounts have not been searched exhaustively.</Note>

      <h2>References</h2>
      {REFERENCES.map((r) => (
        <p key={r.text} className="mb-3 -indent-6 pl-6 text-[0.85rem]">
          {r.text}
          {r.link && (
            <>
              {" "}
              <a href={r.link.href}>{r.link.label}</a>
            </>
          )}
        </p>
      ))}
    </main>
  );
}
