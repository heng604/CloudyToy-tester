import { describe, it, expect } from "vitest";
import { sigV4Authorization } from "../server/lib/r2";

// Official AWS Signature V4 example ("GET Object" with a Range header) from the AWS S3 documentation.
describe("R2 / AWS Signature V4", () => {
  it("matches the AWS documented signature", () => {
    const auth = sigV4Authorization({
      method: "GET", path: "/test.txt", amzDate: "20130524T000000Z", region: "us-east-1", service: "s3",
      accessKey: "AKIAIOSFODNN7EXAMPLE", secretKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      headers: { host: "examplebucket.s3.amazonaws.com", range: "bytes=0-9", "x-amz-content-sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "x-amz-date": "20130524T000000Z" },
    });
    expect(auth).toContain("Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
    expect(auth).toContain("SignedHeaders=host;range;x-amz-content-sha256;x-amz-date");
  });
});
