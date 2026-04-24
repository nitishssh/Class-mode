# 🤝 Contributing to PersonalLearningPro

We love to receive contributions from the community and are thrilled that you're interested in making this project better! 🚀✨

## 🌍 Community

Join our Discord server for discussions, support, and to connect with other contributors:
[https://discord.gg/ewHtFk9G](https://discord.gg/ewHtFk9G) 💬✨

---

## 🏆 Top Contributor Reward

<p align="center">
  <img src="assets/burger-reward.png" alt="Burger Reward" width="180" />
</p>

**🍔 The top contributor gets a meal from the admin at McDonald's!** 🍟🥤

But that's not all — the **🌟 top contributor** will also earn a spot as one of the **🔥 Super 5 Core Members** for PersonalLearningPro. This is your chance to shape the future of this product, have a direct say in key decisions, and be recognized as a core part of the team. 👑✨

**How to become the top contributor:**

- 📝 Submit high-quality pull requests
- 🐞 Fix bugs and resolve issues
- ✨ Add meaningful new features
- 🤝 Help other contributors and review PRs
- 📖 Improve documentation and testing

> 🎉 _Contribute, rise to the top, enjoy a burger, and join the Super 5!_ 🚀🍔

---

## 🚀 Getting Started

### 🐳 Option 1: Docker (Recommended)

The fastest way to get a development environment running — no Node.js install required.

1.  **📦 Fork and clone the repository:**

    ```bash
    git clone https://github.com/your-username/PersonalLearningPro.git
    cd PersonalLearningPro
    ```

2.  **⚙️ Set up environment variables:**

    ```bash
    cp .env.example .env
    ```

    Edit `.env` with your credentials. All variables are optional — see [README.md](README.md#-environment-variables) for details.

3.  **🏗️ Build and run:**

    ```bash
    docker compose build
    docker compose up
    ```

4.  🌐 Open **[http://localhost:5001](http://localhost:5001)** in your browser.

> 🔄 Source files are bind-mounted, so your edits are reflected immediately via hot reload — no rebuild needed for code changes.

### 💻 Option 2: Manual Setup

Requires **Node.js v18+** and **npm**.

1.  **📦 Fork and clone the repository:**

    ```bash
    git clone https://github.com/your-username/PersonalLearningPro.git
    cd PersonalLearningPro
    ```

2.  **📦 Install dependencies:**

    ```bash
    npm install
    ```

3.  **⚙️ Set up environment variables:**

    ```bash
    cp .env.example .env
    ```

    Edit `.env` with your credentials (all optional).

4.  **🚀 Start the development server:**

    ```bash
    npm run dev
    ```

5.  🌐 Open **[http://localhost:5001](http://localhost:5001)** in your browser. Both the frontend and API are served from the same port.

> 📖 For a more detailed manual setup guide, see [LOCAL_SETUP.md](LOCAL_SETUP.md).

## ⚖️ Contributor License Agreement (CLA)

We require all contributors to sign a Contributor License Agreement before their first PR can be merged. 📝 When you open a PR, the CLA Assistant bot will comment with instructions. Simply reply with:

> I have read the CLA Document and I hereby sign the CLA

You only need to sign once — it applies to all future contributions. Read the full [CLA here](CLA.md). 📜

## 🔄 Contribution Workflow

1.  **🌿 Create a new branch** for your feature or bug fix:
    ```bash
    git checkout -b feature/your-feature-name
    ```
2.  **🛠️ Make your changes.**
3.  **🧪 Run TypeScript checks** before committing:
    ```bash
    npm run check
    ```
4.  **📝 Commit your changes** with a descriptive message.
5.  **🚀 Push your changes** to your fork:
    ```bash
    git push origin feature/your-feature-name
    ```
6.  **🔗 Open a pull request** to the `main` branch of the original repository.

## 🤖 AI Agent Contributions

If you are using an AI coding agent (like Gemini CLI, Cursor, or Aider) to contribute to this project: 🧠🤖

1. **📖 Read `AGENTS.md`:** Our repository includes a standard `AGENTS.md` file in the root directory. This acts as a "README for agents" and contains essential environment tips, testing instructions, and coding conventions. 📜✨
2. **🛠️ Use the `.agent` Directory:** For complex tasks, we follow a spec-first workflow. Look inside the `.agent/` directory for our modular context:
   - `.agent/spec/`: Store requirements, design docs, and task lists here. 📋
   - `.agent/prompts/`: Use predefined agent workflows (like `spec-workflow.md`). 📜
   - `.agent/wiki/`: Read architecture deep-dives. 🏛️
   - `.agent/rules/`: Adhere to the `POLICIES.md` defined here. ⚖️
3. **🔐 Keep Workflows Local:** The `.agent/` directory and `AGENTS.md` are ignored in `.gitignore` to prevent cluttering the repository with agent-specific state, but the structure and instructions are maintained locally. Always ensure you follow the instructions in `AGENTS.md`. 🛡️✨

## 🏛️ Architecture Notes

- **📦 Monolith server** — Express serves both the API and the Vite-powered React frontend on **port 5001** 🖥️
- **💾 Hybrid storage** — Uses MongoDB for structured data and Cassandra for message history 📊
- **📱 Mobile app** — React Native + Expo with full offline support and push notifications 📲
- **🔥 Firebase (optional)** — Used for authentication; the app runs without it (auth features disabled) 🔐
- **🤖 OpenAI (optional)** — Powers AI features; the app runs without it 🧠💡
- **⚡ Cassandra (optional)** — Powers MessagePal chat history; the app runs without it (chat history disabled) 💬

## 🎨 Coding Style

This project uses **ESLint** and **Prettier** for code formatting and linting. Please run these commands before committing:

```bash
npm run lint        # Check for linting errors
npm run lint:fix    # Auto-fix linting errors
npm run format      # Format code with Prettier
npm run check       # TypeScript type checking
```

Follow the existing code style in the files you are editing to maintain consistency. 📏✨

## 🐞 Reporting Bugs

If you find a bug, please create an issue on GitHub. 🐞 Include:

- A clear and descriptive title 📝
- Steps to reproduce the bug 🔄
- Any relevant error messages or screenshots 📸

## ✨ Suggesting Enhancements

If you have an idea for an enhancement, please create an issue on GitHub. 💡 Include:

- A clear and descriptive title 📝
- A description of the enhancement and the problem it solves 🚀

## 📚 Additional Resources

- [A guide to contributing to open source](https://opensource.guide/) 📖🌍

Thank you for your interest in contributing to this project! 🚀✨🎓
