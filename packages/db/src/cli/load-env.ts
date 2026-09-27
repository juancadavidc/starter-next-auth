// Los CLIs del paquete corren con cwd = packages/db; el .env vive en la raíz del monorepo.
import { loadRootEnv } from "../root-env";

loadRootEnv();
