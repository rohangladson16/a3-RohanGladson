// Rohan Gladson
// CS 4241: Webware: Computational Technology for Network Information Systems
// server.improved.js 

const http = require( "http" ),
      fs   = require( "fs" ),
      // IMPORTANT: you must run `npm install` in the directory for this assignment
      // to install the mime library if you"re testing this on your local machine.
      // However, Glitch will install it automatically by looking in your package.json
      // file.
      mime = require( "mime" ),
      dir  = "public/",
      port = 3000

// Each item: { exercise, sets, reps, weight, volume }
const workouts = []

const server = http.createServer(function(request, response) {
  if (request.method === "GET") {
    handleGet(request, response)
  } else if (request.method === "POST") {
    handlePost(request, response)
  } else {
    response.writeHead(405, { "Content-Type": "text/plain" })
    response.end("Method Not Allowed")
  }
})

const handleGet = function(request, response) {
  // Results endpoint: return entire dataset
  if (request.url === "/read") {
    response.writeHead(200, { "Content-Type": "application/json" })
    return response.end(JSON.stringify(workouts))
  }

  // Static files
  const clean = request.url.replace(/^\//, "")
  if (clean.includes("..")) {
    response.writeHead(400, { "Content-Type": "text/plain" })
    return response.end("Bad Request")
  }

  const filename = request.url === "/"
    ? dir + "index.html"
    : dir + clean

    return sendFile(response, filename)
}

const handlePost = function( request, response ) {
  let dataString = ""

  request.on( "data", function( data ) {
      dataString += data 
  })

  request.on("end", function() {
    // Try to parse JSON payload (our client always sends JSON)
    let payload = {}
    try {
      payload = dataString ? JSON.parse(dataString) : {}
    } catch (e) {
      response.writeHead(400, { "Content-Type": "text/plain" })
      return response.end("Invalid JSON")
    }

    // To adjust to the feature of being able to handle modifications
    // to the data, I have it to where now, there is a shared validator/deriver
    // so /add and /update stay in sync
    const validateAndCompute = (p) => {
      const { exercise, sets, reps, weight } = p
      const validText =
        typeof exercise === "string" &&
        exercise.trim().length >= 2 &&
        /[a-z]/i.test(exercise)

      const nonNegNum = n => Number.isFinite(n) && n >= 0
      const numbersAreValid = nonNegNum(sets) && nonNegNum(reps) && nonNegNum(weight)

      const allZero         = (sets === 0 && reps === 0 && weight === 0)
      const strengthPattern = (sets > 0 && reps > 0 && weight >= 0)

      if (!validText || !numbersAreValid || !(allZero || strengthPattern)) {
        return { ok: false }
      }
      const volume = allZero ? 0 : (sets * reps * weight)
      return {
        ok: true,
        row: {
          exercise: exercise.trim(),
          sets, reps, weight, volume
        }
      }
    }

    // Add a workout: expects { exercise, sets, reps, weight }
    if (request.url === "/add") {
       // Given the change to modify existing data, I have it whre
       // we now can use shared validator + compute
      const checked = validateAndCompute(payload)
      if (!checked.ok) {
        response.writeHead(400, { "Content-Type": "text/plain" })
        return response.end("Invalid fields")
      }

      workouts.push(checked.row)

      response.writeHead(200, { "Content-Type": "application/json" })
      return response.end(JSON.stringify(workouts))
    }

    // Update by index: Now we have it where it 
    // expects { index, exercise, sets, reps, weight }
    if (request.url === "/update") {
      const { index } = payload
      if (!Number.isInteger(index) || index < 0 || index >= workouts.length) {
        response.writeHead(400, { "Content-Type": "text/plain" })
        return response.end("Invalid index")
      }

      const checked = validateAndCompute(payload)
      if (!checked.ok) {
        response.writeHead(400, { "Content-Type": "text/plain" })
        return response.end("Invalid fields")
      }

      // Replace the row at index with the validated/derived version
      workouts[index] = checked.row

      response.writeHead(200, { "Content-Type": "application/json" })
      return response.end(JSON.stringify(workouts))
    }

    // Delete by index: expects { index }
    if (request.url === "/delete") {
      const { index } = payload
      if (!Number.isInteger(index) || index < 0 || index >= workouts.length) {
        response.writeHead(400, { "Content-Type": "text/plain" })
        return response.end("Invalid index")
      }

      workouts.splice(index, 1)

      response.writeHead(200, { "Content-Type": "application/json" })
      return response.end(JSON.stringify(workouts))
    }

    // Unknown POST route
    response.writeHead(404, { "Content-Type": "text/plain" })
    response.end("Not Found")
  })
}

const sendFile = function(response, filename) {
  const type = mime.getType(filename)

  fs.readFile(filename, function(err, content) {
    if (err === null) {
      response.writeHead(200, { "Content-Type": type })
      response.end(content)
    } else {
      response.writeHead(404, { "Content-Type": "text/plain" })
      response.end("404 Error: File Not Found")
    }
  })
}
server.listen(process.env.PORT || port)