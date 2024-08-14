addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Construct the target URL by appending the path from the incoming request
  const url = new URL(request.url)
  const targetUrl = `https://i.docln.net${url.pathname}`

  // Create a new request to the target URL with the desired Referer header
  const newRequest = new Request(targetUrl, {
      method: request.method,
      headers: {
          ...request.headers,
          'Referer': 'https://docln.net'
      },
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      redirect: 'manual'
  })

  try {
      // Fetch the response from the target URL
      const response = await fetch(newRequest)

      // Return the response back to the client
      return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
      })
  } catch (error) {
      return new Response('Error fetching the target URL', { status: 500 })
  }
}
