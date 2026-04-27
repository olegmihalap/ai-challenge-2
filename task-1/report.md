# Leaderboard Implementation Report

## Approach

I rebuilt the leaderboard as a dependency-free static web application using plain HTML, CSS, and JavaScript. The implementation mirrors the provided interface structure: a header, filter bar, search input, top-three podium, ranked list rows, category statistics, total scores, and expandable details.

The app calculates the visible ranking in the browser. Search, year, quarter, and category filters all update the list and podium together, while rows remain sorted by total score with a name-based tie breaker.

## Tools and Techniques

- HTML for the page structure and accessible form controls.
- CSS for the visual clone, including the podium layout, row cards, avatars, responsive layout, and interactive states.
- JavaScript for generating the synthetic leaderboard data, filtering, sorting, rendering, and expand/collapse behavior.
- GitHub Pages as the deployment target, serving the static files directly from the repository.

## Data Replacement

No original personal or company data is stored in the solution. I did not copy names, account names, profile photo URLs, email addresses, real titles, or real department names from the supplied markup.

Instead, the application generates a fictional leaderboard dataset from neutral name pools, generic role labels, invented organizational groups, synthetic year/quarter values, and generated score/category distributions. Profile photos were replaced with local CSS avatar circles that show initials, so the site does not load private external assets.
