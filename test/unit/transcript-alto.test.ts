import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { altoToText } from "../../src/core/transcripts/alto.ts";

describe("altoToText", () => {
  it("pulls CONTENT from String elements joined with spaces", () => {
    const xml = `<?xml version="1.0"?>
      <alto xmlns="http://www.loc.gov/standards/alto/ns-v3#">
        <Layout>
          <Page>
            <PrintSpace>
              <TextBlock>
                <TextLine>
                  <String CONTENT="Hello"/>
                  <SP/>
                  <String CONTENT="world"/>
                </TextLine>
              </TextBlock>
            </PrintSpace>
          </Page>
        </Layout>
      </alto>`;
    assert.equal(altoToText(xml), "Hello world");
  });

  it("newline between TextLines, blank line between TextBlocks", () => {
    const xml = `
      <TextBlock>
        <TextLine><String CONTENT="line one"/></TextLine>
        <TextLine><String CONTENT="line two"/></TextLine>
      </TextBlock>
      <TextBlock>
        <TextLine><String CONTENT="para two"/></TextLine>
      </TextBlock>`;
    assert.equal(altoToText(xml), "line one\nline two\n\npara two");
  });

  it("handles namespaced tags (alto: prefix)", () => {
    const xml = `
      <alto:TextBlock xmlns:alto="http://www.loc.gov/standards/alto/ns-v3#">
        <alto:TextLine>
          <alto:String CONTENT="Foo"/>
          <alto:String CONTENT="bar"/>
        </alto:TextLine>
      </alto:TextBlock>`;
    assert.equal(altoToText(xml), "Foo bar");
  });

  it("tolerates single-quoted CONTENT attributes", () => {
    const xml = `<TextBlock><TextLine><String CONTENT='quux'/></TextLine></TextBlock>`;
    assert.equal(altoToText(xml), "quux");
  });

  it("decodes XML entities", () => {
    const xml = `<TextBlock><TextLine><String CONTENT="Fa&amp;lc&#x6F;n"/></TextLine></TextBlock>`;
    assert.equal(altoToText(xml), "Fa&lcon");
  });

  it("falls back to flat String extraction when no TextBlocks", () => {
    const xml = `<String CONTENT="one"/><String CONTENT="two"/>`;
    assert.equal(altoToText(xml), "one two");
  });

  it("returns empty string for input with no CONTENT attributes", () => {
    assert.equal(altoToText("<alto><Layout/></alto>"), "");
  });
});
