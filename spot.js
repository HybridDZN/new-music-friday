const fs = require("fs");
const axios = require("axios");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const INPUT_FILE = "input.txt";
const CSV_FILE = "input.csv";
const SPOTIFY_API_TOKEN = process.env.SPOTIFY_API_TOKEN;
const MARKET = "AU";

if (!SPOTIFY_API_TOKEN) {
	console.error("Error: SPOTIFY_API_TOKEN is not set.");
	process.exit(1);
}

console.log("Using Spotify API Token:", SPOTIFY_API_TOKEN);

async function fetchAlbumData(albumId) {
	try {
		const url = `https://api.spotify.com/v1/albums/${albumId}?market=${MARKET}`;
		const response = await axios.get(url, {
			headers: {
				Authorization: `Bearer ${SPOTIFY_API_TOKEN}`,
				"Content-Type": "application/json",
			},
		});
		return response.data;
	} catch (error) {
		console.error(
			`Error fetching album ${albumId}:`,
			error.response ? error.response.data : error.message
		);
		return null;
	}
}

async function readInputFile() {
	try {
		const urls = fs.readFileSync(INPUT_FILE, "utf-8").trim().split("\n");
		return urls.map((url) => url.split("/").pop());
	} catch (error) {
		console.error("Error reading input file:", error);
		return [];
	}
}

async function appendToCSV(albums) {
	const header = "artist,name,album_art_url,genres,type,release_date\n";
	if (!fs.existsSync(CSV_FILE)) {
		fs.writeFileSync(CSV_FILE, header);
	}

	const rows = albums.map((album) => {
		const artist = album.artists.map((a) => a.name).join(", ");
		const name = album.name;
		const albumArtUrl = album.images[0]?.url ?? "";
		const genres =
			album.genres.length > 0 ? JSON.stringify(album.genres) : "";
		const type = album.album_type;
		const releaseDate = album.release_date;

		return `${artist},${name},${albumArtUrl},${genres},${type},${releaseDate}`;
	});

	fs.appendFileSync(CSV_FILE, rows.join("\n") + "\n");
}

function validateCSV() {
	if (!fs.existsSync(CSV_FILE)) {
		console.error("CSV file does not exist.");
		return;
	}

	const data = fs.readFileSync(CSV_FILE, "utf-8").trim().split("\n");
	const headers = [
		"artist",
		"name",
		"album_art_url",
		"genres",
		"type",
		"release_date",
	];
	const fileHeaders = data[0].split(",");

	if (JSON.stringify(fileHeaders) !== JSON.stringify(headers)) {
		console.error("CSV headers do not match expected format.");
		return;
	}

	for (let i = 1; i < data.length; i++) {
		const row = data[i].split(",");
		if (row.length !== headers.length) {
			console.error(`Row ${i} has incorrect number of fields:`, row);
		}
		if (!row[2].startsWith("http")) {
			console.error(`Row ${i} has an invalid album_art_url:`, row[2]);
		}
		try {
			JSON.parse(row[3] || "[]");
		} catch (error) {
			console.error(`Row ${i} has invalid genres formatting:`, row[3]);
		}
	}

	console.log("CSV validation completed.");
}

(async () => {
	const albumIds = await readInputFile();
	const albumData = (await Promise.all(albumIds.map(fetchAlbumData))).filter(
		Boolean
	);
	if (albumData.length) {
		await appendToCSV(albumData);
		console.log("CSV file updated successfully.");
		validateCSV();
	} else {
		console.log("No new albums fetched.");
	}
})();
