addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Parse the incoming request URL
  const url = new URL(request.url)

  // Set the default target domain to i.docln.net
  let targetDomain = 'i.docln.net'

  // Check if the pathname starts with /i2/, /i3/, etc.
  const pathSegments = url.pathname.split('/').filter(Boolean) // Split path into segments, filter out empty strings

  // If the first segment is i2, i3, etc., update the target domain
  if (pathSegments[0] && pathSegments[0].startsWith('i') && !isNaN(pathSegments[0][1])) {
    targetDomain = `${pathSegments[0]}.docln.net` // Sets the domain to i2.docln.net, i3.docln.net, etc.
    pathSegments.shift() // Remove the /i2/, /i3/, etc. from the path
  }

  // Construct the target URL by appending the modified path segments to the target domain
  const targetUrl = `https://${targetDomain}/${pathSegments.join('/')}`

  // Clone the request and add the Referer header
  const newRequest = new Request(targetUrl, {
    method: request.method,
    headers: {
      ...request.headers,
      'Referer': 'https://docln.net'  // Set the desired Referer header
    },
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    redirect: 'manual' // Do not automatically follow redirects
  })

  try {
    // Fetch the response from the target URL
    const response = await fetch(newRequest)

    // Return the fetched response back to the client
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    })
  } catch (error) {
    // Return an error response in case of failure
    return new Response('Error fetching the target URL', { status: 500 })
  }
}
