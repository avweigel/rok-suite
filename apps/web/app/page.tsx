export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900 text-white">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">ROK Suite</h1>
        <p className="text-2xl mb-8">Rise of Kingdoms Tools & Strategy</p>
        <a
          href="/aoo-strategy"
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-8 rounded-lg text-xl"
        >
          Go to Ark of Osiris Strategy →
        </a>
      </div>
    </div>
  );
}