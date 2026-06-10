import { test } from "node:test";
import assert from "node:assert/strict";
import { detectErrorsInHtml } from "./evidence-health-check.ts";

test("detects Svelte component left open overlay", () => {
	const errors = detectErrorsInHtml(`
		<div>Error</div>
		<pre>Component was left open. Ensure all components are closed.</pre>
	`);

	assert.ok(errors.includes("Svelte component parse error"));
});

test("detects invalid tag name overlay", () => {
	const errors = detectErrorsInHtml(`
		<pre>Expected valid tag name: Line 1128, column 105</pre>
	`);

	assert.ok(errors.includes("Svelte invalid tag parse error"));
});

test("detects expected tag close overlay", () => {
	const errors = detectErrorsInHtml(`
		<pre>Expected &gt;</pre>
	`);

	assert.ok(errors.includes("Svelte expected tag close parse error"));
});

test("detects runtime reference and property errors", () => {
	const errors = detectErrorsInHtml(`
		<pre>ReferenceError: BigValue is not defined</pre>
		<pre>Cannot read properties of undefined</pre>
	`);

	assert.ok(errors.includes("Runtime reference error"));
	assert.ok(errors.includes("Runtime JS error"));
});

test("does not flag healthy Evidence shell HTML", () => {
	const errors = detectErrorsInHtml(`
		<html>
			<head><script>import("/_app/immutable/start.js")</script></head>
			<body><h1>Dashboard</h1></body>
		</html>
	`);

	assert.deepEqual(errors, []);
});
