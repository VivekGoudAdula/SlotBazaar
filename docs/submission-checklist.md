# Arkiv Web3 Database Builders Challenge — Submission Checklist

*Source: [Arkiv Network RULES.md & Builder's Guide](https://github.com/Arkiv-Network/arkiv-web3-database-builders-challenge)*

---

## 1. Submission Requirements (RULES.md §4)

All submissions must include:

| Requirement | Details |
|-------------|---------|
| **GitHub repository** | Public repo with open source license (MIT, Apache 2.0, or equivalent) |
| **Working demo** | Deployed and accessible via URL, connected to Arkiv testnet |
| **README** | Setup instructions, tech stack used, team members, and a brief description of your approach |
| **Submission form** | Completed official submission form with repo link, demo link, team info, and wallet address |

### What Counts as a Valid Submission
- Must fall within one of the three approved verticals: **Job Board**, **Event Platform**, or **Knowledge Base** (or track: industrial capacity exchange / marketplace)
- Must use Arkiv as the primary data layer
- Must be original work created during the Challenge period
- Pre-existing code (libraries, frameworks, boilerplate) is allowed, but the Arkiv integration and core application logic must be new
- Use of AI coding assistants (Copilot, Claude, etc.) is allowed and encouraged

### What Will Disqualify a Submission
- Plagiarized or copied code from another participant
- Submissions that don't use Arkiv as the data layer
- Submissions outside the approved verticals
- Malicious code, backdoors, or security vulnerabilities introduced intentionally
- Submissions that don't include a working demo
- Submissions after the deadline

---

## 2. Technical Baseline Checklist (builders-guide.md §2)

- [x] **All core data stored as Arkiv entities** (not in a traditional database)
- [x] **Wallet-based ownership** (creators own their data)
- [x] **At least 2 entity types with a relationship between them**
- [x] **Queryable attributes used for filtering or search**
- [x] **Rational expiration dates on entities** (differentiated lifespans)
- [x] **Public read access** (no wallet needed to browse)
- [x] **Open source GitHub repo**
- [x] **Working demo link**
- [x] **README with setup instructions**
