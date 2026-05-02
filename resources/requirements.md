# Requirements analysis

## Basic Requirements

### T-requirements
* Privacy is prioritized. ✅
* Data is E2E encrypted. ✅
* Data is persisted decentralized on the clients and shared via p2p networking. ✅
* Usability is kept in mind.
* Data is encrypted at rest. ✅
* No Account creation necessary. ✅

### Account
* The system shall support the creation and management of virtual accounts. ✅

### Transaction
* The system shall allow users to manually add transactions. ✅
* The system shall allow users to import data.
* The system shall allow users to export data.

### Space
* The system shall allow users to create multiple spaces. ✅
* The system shall allow users to invite peers to a space via a key. ✅
* The system shall allow users to join multiple spaces. ✅
* The system shall allow users to share transactions into different spaces. ✅
* The system shall allow users to track debts.

### Category
* Thy system shall provide a set of predefined categories that can be used to organize transactions. ✅

### Tag
* The system shall allow users to define custom tags and apply them to transactions. ✅

### Budget
* The system shall allow users to create custom budgets.
* The system shall allow users to select the time period for a budget.
* The system shall support one-time budgets.

### Goal
* The system shall allow users to reserve funds ("ring-fence") within an account for specific purposes (e.g., for upcoming expenses).
* The system shall display the available balance versus the total balance, accounting for reserved funds.

### View / Reporting
* The system shall allow filtering of transactions by period, category, tag, amount range, recipient, and search term.
* The system shall allow filtering of statistics by account, tag, and category.
* The system shall allow users to exclude transfers from statistics.
* The system shall provide an overview of money flow per category and/or recipient.

---
## Advanced Requirements

### Account
* The system shall support various bank account types, including checking, savings, shared accounts, credit cards, crypto wallets, PayPal, Skrill, Neteller, and Portfolios.
* The system shall automatically and regularly synchronize linked accounts.
* The system shall support integration with major Austrian banks.
* The system shall allow manual tracking of credit cards, portfolios, and crypto wallets.
* The system shall support multiple currencies.

### Transaction
* The system shall allow transactions to be assigned to specific users.
* The system shall automatically categorize transactions.
* The system shall allow users to review and approve automated changes (e.g. categorization).
* The system shall provide fuzzy typing suggestions for the title when manually adding a transaction. 
* The system shall automatically prefill the category based on the title when manually adding a transaction. 
* The system shall utilize AI/LLM or VectorDB-based mechanisms to improve categorization accuracy.
* The system shall suggest tags when manually adding a transaction. 
* The system shall allow users to add manual transactions to synced accounts. 
* The system shall automatically detect merchants and recipients. 
* The system shall automatically link transfer transactions between accounts.
* The system shall automatically recognize recurring payments. 
* The system shall automatically recognize refunds. 
* The system shall allow users to override details of synced transactions.
* The system shall detect and flag anomalous or potentially fraudulent transactions. 
* The system shall support multicurrency transactions for synced accounts. ⛔
* The system shall predict recurring patterns to inform users of upcoming bills.
* The system shall allow users to note an upcoming refund against a specific transaction. ⛔
* The system shall support automatic import of Apple Pay and Google Pay transactions. ⛔
* The system shall allow users to split transactions. ⛔
* The system shall allow bulk editing of transactions. ⛔
* The system shall allow users to create templates for transactions. ⛔

### Space
* The system shall allow users to invite peers via a QR Code (key). ✅

### Category
* The system shall allow users to define custom categories.
* The system shall allow users to override existing categories.
* The system shall allow customization of categories, including icons and colors.

### Attachment
* The system shall support the upload of multiple attachments with various file types to a transaction.
* The system shall perform OCR on attachments to extract transaction details (e.g., items purchased).
* The system shall support automatic transaction creation from receipts, including title generation, categorization, content extraction, and amount determination.

### Rule
* The system shall allow users to define custom rules for transaction categorization.
* The system shall support custom rules for accounts, including automatic recognition of transfers to/from virtual accounts.

### Budget
### Goal
* The system shall notify the user if they attempt to spend or move reserved funds. ⛔

### View / Reporting
* The system shall include a local AI Chat/Assistant feature to answer user queries (e.g., "What am I spending the most money on each month?").
* The system shall display average and median values for extended time periods.
* The system shall allow users to define the time period for a view.
* The system shall allow users to save custom views filtered by specific criteria (e.g., tags).
* The system shall provide financial forecasting functionality.
* The system shall allow users to archive views. ⛔
* The system shall display predicted future transactions. ⛔
* The system shall provide a calendar-based view of transactions. ⛔
* The system shall provide a web interface for user interaction. ⛔

### Space (Collaboration)
* The system shall allow users to share data with other users. ✅
* The system shall support Shared Spaces to control transaction visibility for participants. ✅
* The system shall allow the creation of temporary shared spaces (e.g., for vacations).
* The system shall feature automatic recognition of shared transactions (configurable per space, with optional confirmation).
* The system shall provide shared statistics, categories, tags, and budgets/goals within shared spaces.
* The system shall allow users to view money spent per participant within a shared space.


## Domain objects

* User
    * user of the application
* Account
    * The link to an account from a financial institution, e.g. a bank account
* Wallet
    * Provides the context for a transaction, e.g. represents a bank account in the app itself
* Transaction
    * contains the data of a finacial transaction, e.g. money getting moved
    * A transaction can hold the following information:
        * Title (short)
        * Notes?/Description? (for more detailed explanations)
        * Amount
        * Linked Account
        * Category
        * Tags?
        * Date
        * time?
        * Attachments?
* Category
    * used to organize transactions into different groups.
    * A category consists of a Name and color (Icon?)
* Tag
    * provides context about a transaction even across different categories 
    * Consists of a single name (string)
* Attachment
    * is a file that was uploaded in the context of a transaction
* View
    * Defines filters, periods and sorting as well as the way of displaying financial data in the app
* Budget
    * tracks how much you spend for a category in a given time period (one time, weekly, etc.)
* Goal
    * Allows you to mark funds on an account for a certain goal
* Space
    * Defines the context in which you can share transactions with other users
    * All users that are part of a certain space can see all trasactions that have been shared to this particular space.

# Ideas for the future
* Allow linking of devices to work on multiple devices
* Implement the option to specify a bank account syncing server. (Optional (custom) centralized server specified by the end user to allow the app to work with banking apis)