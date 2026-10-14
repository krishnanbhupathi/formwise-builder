import { Centered, Shell } from "./components/Shell";
import { linkProps, parseRoute, usePathname } from "./lib/router";
import { EditForm } from "./pages/EditForm";
import { Fill } from "./pages/Fill";
import { MyForms } from "./pages/MyForms";
import { NewForm } from "./pages/NewForm";
import { Submissions } from "./pages/Submissions";

export function App() {
  const route = parseRoute(usePathname());
  switch (route.name) {
    case "new":
      return <NewForm />;
    case "forms":
      return <MyForms />;
    case "edit":
      return <EditForm key={route.id} id={route.id} />;
    case "submissions":
      return <Submissions key={route.id} id={route.id} />;
    case "fill":
      return <Fill key={route.id} id={route.id} />;
    case "notFound":
      return (
        <Shell>
          <Centered>
            <h1 className="text-xl font-semibold">Page not found</h1>
            <a {...linkProps("/")} className="text-accent underline">Build a form</a>
          </Centered>
        </Shell>
      );
  }
}
