# Project guidance

Follow the [project conventions](.ai/guidelines/project.md). Start every UI change in the
[TimeReport Figma file](https://www.figma.com/design/KpKv5XyY4IdFjW63GlbyRi/TimeReport) before editing
the application code.

Start each new task on its own branch and work through a pull request. Follow the
[pull request workflow](.ai/guidelines/project.md#pull-request-workflow) for opening and merging it.

Run pull request verification locally. Run `composer ci:check` and run the test suite against both
SQLite and PostgreSQL. Use the local results to verify the pull request before marking it ready for
review or merging it.
