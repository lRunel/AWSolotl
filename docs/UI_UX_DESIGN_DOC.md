# UI/UX Design Document: Lockstep Recall Dashboard

## 1. Vision & Purpose
The Lockstep Recall Dashboard is the transparent window into the autonomous agent's operations. Its primary goal is to **build trust** between human operators and the AI by clearly explaining *what* the agent is doing, *why* it made a decision (especially when abstaining or failing a gate), and *how* the system is currently performing. It will also serve as the central hub for system documentation.

## 2. Psychological & Aesthetic Principles
To achieve an award-winning, "Mac-like" professional aesthetic, the design will leverage human psychology and modern design patterns, moving completely away from any generic "AWSolotl" or superhero theming.

* **Trust through Clarity (Cognitive Ease):** When servers are failing, operators experience high cognitive load. The UI must be a calming influence. Information will be progressively disclosed (showing high-level status first, allowing drill-down into cryptographic reasoning).
* **The "Apple" Aesthetic (Skeuomorphism meets Flat Design):** We will use **Glassmorphism** (frosted glass, background blurs) over subtle, dark, monochromatic gradients to convey depth, precision, and high-end engineering. 
* **Tactile Feedback:** Buttons and timeline nodes will have micro-interactions (subtle scaling, smooth color transitions) that feel instantly responsive, reassuring the user that the system is fully under control.

## 3. Color Palette & Typography
* **Typography:** `SF Pro Display` (or `Inter` as a web-safe alternative) for a clean, geometric, highly legible look.
* **Base Theme (Dark Mode Default):** Deep, sophisticated grays to reduce eye strain.
  * *Background:* `#0D0E15` (Deep Space Gray)
  * *Surfaces (Cards/Modals):* `#1A1D24` with a 40% opacity blur (Frosted Glass)
* **Accent Colors (Semantic & Calming):**
  * *Primary/Interactive:* `#007AFF` (Mac OS Blue) - used for active states and navigation.
  * *Healthy/Success:* `#34C759` (Soft Mint) - used for passed gates and healthy server status.
  * *Abstain/Warning:* `#FF9F0A` (Amber) - used when the agent abstains due to a lack of confidence or missing invariants.
  * *Critical:* `#FF453A` (Muted Crimson) - clearly signals an outage or a blocked unsafe action without inducing panic.

## 4. Opening Animation
Instead of a jarring, heavy loading screen, the webpage will feature a highly polished, buttery-smooth opening sequence:
1. **The Hash Chain:** A minimalist, glowing line draws across the center of the screen, connecting a few cryptographic "nodes" (representing the immutable ledger). 
2. **The Bloom:** The line gently fades into a subtle, blurred gradient background.
3. **The Reveal:** The UI elements (sidebar, cards) smoothly slide in from the bottom with a slight fade (staggered animation), settling into place. This takes exactly 1.2 seconds—fast enough to not waste time, but deliberate enough to feel premium.

## 5. Information Architecture & Layout

### A. The Navigation (Sidebar)
A sleek, frosted-glass sidebar on the left containing:
* **Live System Health:** Real-time metrics (ADOT/X-Ray).
* **The Ledger (Core View):** The immutable cryptographic record of the agent's actions.
* **Documentation:** Integrated PDF/Markdown viewer.

### B. The Ledger View (The Core Experience)
This is where the user understands the agent's reasoning. 
* **Timeline UI:** Events are displayed as a vertical timeline.
* **Event Cards:** Each time the agent proposes a plan, a card appears.
  * **Status Badge:** A prominent badge (e.g., "Executed", "Abstained (Scope Lie)", "Blocked by Gate 2").
  * **The "Why":** A beautifully formatted block quoting the exact reasoning (e.g., *"Abstained: Simulated ARNs exceed declared blast radius. Org Rule ORG-05 applied."*)
  * **Expandable Cryptographic Proof:** Users can click a sleek chevron to expand the card and view the raw Cedar policy evaluation, the causal graph, and the SHA-256 hashes verifying the record hasn't been tampered with.

### C. The Live System Health
A minimalist dashboard tracking the demo app (`web` and `payments`).
* Smooth, curving line charts (no sharp, jagged edges) showing latency and error rates.
* A prominent "Chaos Mode" toggle button designed like an iOS switch, allowing the user to inject latency or errors to watch the agent react in real-time.

### D. Documentation Portal
* A clean, split-pane reader. Left pane for the table of contents (linking to the newly added design PDFs and markdown files), right pane for the content.
* Smooth page transitions and a distraction-free reading mode.

## 6. Next Steps for Implementation
1. **Tech Stack Selection:** React/Next.js for the frontend, Framer Motion for the premium animations, and Tailwind CSS for the glassmorphism and styling.
2. **Wireframing:** Create the skeleton of the layout.
3. **Prototyping:** Build the opening animation and the Ledger Timeline component.
4. **Integration:** Connect the frontend to the AWS API Gateway (`/plans` and `/ledger/verify`) and the `/chaos` endpoints.
