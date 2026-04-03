const Home = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to WinePooler</h1>
        <p className="text-gray-600 mb-8">Aggregate wine orders efficiently</p>
        <div className="space-x-4">
          <a href="/register" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Register
          </a>
          <a href="/login" className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
            Login
          </a>
        </div>
      </div>
    </div>
  )
}

export default Home