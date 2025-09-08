export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function FreedomSchoolRouteSmokeTest() {
  // This is just a smoke test message so you can confirm routing.
  // Your real Freedom School page can replace this component once the route is verified.
  return (
    <div className="min-h-[50vh] grid place-items-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Freedom School</h1>
        <p className="text-white/70 mt-2">/freedom-school route loaded.</p>
      </div>
    </div>
  );
}
