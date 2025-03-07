const fs = require("fs");
const csv = require("csv-parse");
const { createCanvas, loadImage } = require("canvas");

// Configuration
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 2500;
const BACKGROUND_COLOR = "#fafafa";
const TEXT_COLOR = "#000000";
const FONT_FAMILY = "Arial";
const ALBUM_ART_SIZE = 150;
const PADDING = 30;
const LINE_HEIGHT = 45;
const MAX_TEXT_WIDTH = CANVAS_WIDTH - (PADDING * 3 + ALBUM_ART_SIZE);
const CSV_FILE = "input.csv";

// Function to format the current date for the output file name
function getFormattedDate() {
	const date = new Date();
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}${month}${day}`;
}

// Function to correctly parse the date format (DD/MM/YYYY)
function parseDate(dateStr) {
	if (!dateStr) return null;
	const [day, month, year] = dateStr.split("/").map(Number);
	return new Date(year, month - 1, day); // Month is 0-based in JS
}

// Function to handle text wrapping for canvas
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
	const words = text.split(" ");
	let line = "";
	for (let i = 0; i < words.length; i++) {
		const testLine = line + words[i] + " ";
		const metrics = ctx.measureText(testLine);
		if (metrics.width > maxWidth && i > 0) {
			ctx.fillText(line, x, y);
			line = words[i] + " ";
			y += lineHeight;
		} else {
			line = testLine;
		}
	}
	ctx.fillText(line, x, y);
	return y;
}

// Function to process CSV and filter releases from the past 7 days
async function processReleases(csvFilePath) {
	const today = new Date();
	const oneWeekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

	today.setHours(0, 0, 0, 0);
	oneWeekAgo.setHours(0, 0, 0, 0);

	try {
		const releases = await new Promise((resolve, reject) => {
			const results = [];
			fs.createReadStream(csvFilePath)
				.pipe(
					csv.parse({
						columns: true,
						skipEmptyLines: true,
						trim: true,
					})
				)
				.on("data", (data) => {
					const releaseDate = parseDate(data.release_date);

					if (releaseDate) {
						releaseDate.setHours(0, 0, 0, 0);
						console.log(
							`✅ Parsed date: ${releaseDate.toDateString()} for ${
								data.artist
							} - ${data.name}`
						);

						if (releaseDate >= oneWeekAgo && releaseDate <= today) {
							try {
								data.genres = JSON.parse(data.genres);
							} catch (e) {
								data.genres = data.genres
									.split(",")
									.map((genre) => genre.trim());
							}
							results.push(data);
						}
					} else {
						console.warn(
							`⚠️ Invalid date for ${data.artist} - ${data.name}: ${data.release_date}`
						);
					}
				})
				.on("end", () => resolve(results))
				.on("error", reject);
		});

		return releases;
	} catch (error) {
		console.error("❌ Error processing CSV:", error.message);
		throw error;
	}
}

// Function to generate image based on new releases
async function generateImage(releases) {
	const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
	const ctx = canvas.getContext("2d");

	ctx.fillStyle = BACKGROUND_COLOR;
	ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

	// Title
	ctx.fillStyle = TEXT_COLOR;
	ctx.font = `bold 60px ${FONT_FAMILY}`;
	ctx.fillText("New Music Friday", PADDING, 90);

	// Date
	ctx.font = `45px ${FONT_FAMILY}`;
	const today = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
	});
	ctx.fillText(today, PADDING, 160);

	let yPosition = 220;

	for (const release of releases) {
		try {
			const img = await loadImage(release.album_art_url);
			ctx.drawImage(
				img,
				PADDING,
				yPosition,
				ALBUM_ART_SIZE,
				ALBUM_ART_SIZE
			);

			ctx.font = `bold 40px ${FONT_FAMILY}`;
			yPosition = wrapText(
				ctx,
				`${release.artist} - ${release.name}`,
				PADDING + ALBUM_ART_SIZE + 20,
				yPosition + 35,
				MAX_TEXT_WIDTH,
				LINE_HEIGHT
			);

			ctx.font = `32px ${FONT_FAMILY}`;
			yPosition = wrapText(
				ctx,
				`${release.type} (${release.genres.join(", ")})`,
				PADDING + ALBUM_ART_SIZE + 20,
				yPosition + 35,
				MAX_TEXT_WIDTH,
				LINE_HEIGHT
			);

			ctx.font = `28px ${FONT_FAMILY}`;
			yPosition = wrapText(
				ctx,
				release.release_date,
				PADDING + ALBUM_ART_SIZE + 20,
				yPosition + 35,
				MAX_TEXT_WIDTH,
				LINE_HEIGHT
			);

			yPosition += PADDING * 2;
		} catch (error) {
			console.error(
				`❌ Error processing image for ${release.artist} - ${release.name}:`,
				error
			);
			continue;
		}
	}

	const fileName = `new-releases-${getFormattedDate()}.jpg`;
	const buffer = canvas.toBuffer("image/jpeg", { quality: 0.9 });
	fs.writeFileSync(`output/${fileName}`, buffer);
	return fileName;
}

// Main function to run everything
async function main() {
	try {
		const releases = await processReleases(CSV_FILE);
		if (releases.length === 0) {
			console.log("🚫 No releases found for the previous week.");
			return;
		}
		const fileName = await generateImage(releases);
		console.log(`✅ Image generated successfully: ${fileName}`);
	} catch (error) {
		console.error("❌ Error:", error);
	}
}

main();
