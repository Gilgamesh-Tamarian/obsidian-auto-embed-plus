import { isUrl, parseQuizletSetId } from "../url.utils";

describe('isUrl', () => {
	const inputToExpectedOutput = [
		["Quotes at vault/test.md", false],
		["https://github.com/", true],
		["https://www.youtube.com/watch?v=FY7DtKMBxBw", true],
	]
	it.each(inputToExpectedOutput)('should correctly parse "%s"', (input: string, expected) => {
		const output = isUrl(input);

		expect(output).toStrictEqual(expected)
	})
})

describe('parseQuizletSetId', () => {
	it.each([
		["https://quizlet.com/123456789/flashcards", "123456789"],
		["https://quizlet.com/de/123456789/flashcards", "123456789"],
		["https://quizlet.com/de/karteikarten/medias-in-res-lektion-1-529466333?i=4ayep3&x=1jqt", "529466333"],
		["https://www.quizlet.com/sets/987654321", "987654321"],
		["https://example.com/de/karteikarten/medias-in-res-lektion-1-529466333", null],
		["not-a-url", null],
	])('extracts set id from "%s"', (input: string, expected: string | null) => {
		expect(parseQuizletSetId(input)).toBe(expected);
	});
});
