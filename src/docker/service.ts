export type DockerComposeService = {
  name: string;
  dependsOn: string[];
  image?: string;
};
