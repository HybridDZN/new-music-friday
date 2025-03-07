const fs = require("fs");
const readline = require("readline");

const CSV_FILE = "input.csv";

async function validateCSV() {
	const fileStream = fs.createReadStream(CSV_FILE);
	const rl = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity,
	});

	let lineNumber = 0;
	let headers = [];
	let errors = [];

	for await (const line of rl) {
		lineNumber++;
		// Improved CSV parsing to correctly handle quoted fields
		const parts = line
			.match(/(?:"([^"]*)"|([^,]*))(?:,|$)/g)
			.map((p) => p.replace(/,$/, "").replace(/^"|"$/g, ""));

		if (lineNumber === 1) {
			headers = parts.map((h) => h.trim()); // Normalize headers
			if (
				headers.length !== 6 ||
				headers.join(",") !==
					"artist,name,album_art_url,genres,type,release_date"
			) {
				errors.push(
					"Invalid headers. Expected: artist,name,album_art_url,genres,type,release_date"
				);
			}
			continue;
		}

		if (parts.length !== 6) {
			errors.push(`Line ${lineNumber}: Incorrect number of columns`);
			continue;
		}

		let [artist, name, albumArtUrl, genres, type, releaseDate] = parts;

		if (!artist || !name || !albumArtUrl || !releaseDate) {
			errors.push(`Line ${lineNumber}: Missing required fields`);
		}

		if (!/^https?:\/\//.test(albumArtUrl)) {
			errors.push(`Line ${lineNumber}: Invalid album art URL`);
		}

		// Ensure genre is valid JSON or set default
		if (!genres || genres.trim() === "") {
			genres = '["N/A"]';
		} else {
			try {
				const parsedGenres = JSON.parse(genres);
				if (!Array.isArray(parsedGenres)) {
					throw new Error();
				}
			} catch {
				errors.push(`Line ${lineNumber}: Invalid genres format`);
			}
		}

		// Capitalize the type field
		if (!type) {
			errors.push(`Line ${lineNumber}: Missing type field`);
		} else {
			type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
		}
	}

	if (errors.length > 0) {
		console.error("CSV Validation Errors:");
		errors.forEach((error) => console.error(error));
	} else {
		console.log("CSV validation passed successfully.");
	}
}

validateCSV();
