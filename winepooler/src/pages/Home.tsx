const Home = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-alt">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary mb-4">Welcome to WinePooler</h1>
        <p className="text-secondary mb-8">Aggregate wine orders efficiently</p>
        <div className="space-x-4">
          <a href="/register" className="bg-primary text-primary-text px-4 py-2 rounded hover:bg-primary-hover">
            Register
          </a>
          <a href="/login" className="bg-surface-elevated text-primary px-4 py-2 rounded border border-border hover:bg-surface-alt">
            Login
          </a>
        </div>
      </div>
    </div>
  )
}

export default Home