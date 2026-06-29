# TODOS

- [ ] **Learner Mastery Visualization Dashboard**
  - **What**: Add a Learner Mastery and Spaced Repetition Visualization panel in the Learn Hub UI.
  - **Why**: Allows students to see their own learning curves, current concept mastery levels, and upcoming review schedules, enhancing motivation and study planning.
  - **Pros**: Increases student engagement and provides transparent, actionable progress metrics.
  - **Cons**: Requires frontend dashboard UI implementation and state synchronization.
  - **Context**: Once the backend adaptivity engine updates the `learner_mastery` and `review_schedule` tables, we will need a dedicated UI panel (e.g. in the Learn Hub or Profile page) to read this data and render mastery percentages and review cards.
  - **Depends on**: The backend database updates being active (`feat/learn-hub`).
