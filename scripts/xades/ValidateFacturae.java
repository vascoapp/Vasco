// The EU Commission's DSS (Digital Signature Service) over our signed Facturae
// samples — run by scripts/check-facturae-signature.mjs, never by the app.
//
// Usage: java -cp 'lib/*:.' ValidateFacturae <trustAnchor.pem> <crl.der> <policy.pdf|-> <sample.xml>...
// Prints ONE JSON line per sample on stdout. Offline: no AIA / OCSP / online
// CRL; the only trust anchor is the throwaway test CA, the only revocation
// data the CRL that CA just issued, and the only policy document the one
// passed in (or none with "-").
import eu.europa.esig.dss.diagnostic.DiagnosticData;
import eu.europa.esig.dss.diagnostic.SignatureWrapper;
import eu.europa.esig.dss.diagnostic.jaxb.XmlDigestMatcher;
import eu.europa.esig.dss.diagnostic.jaxb.XmlSignerRole;
import eu.europa.esig.dss.model.DSSDocument;
import eu.europa.esig.dss.model.FileDocument;
import eu.europa.esig.dss.simplereport.SimpleReport;
import eu.europa.esig.dss.spi.DSSUtils;
import eu.europa.esig.dss.spi.policy.SignaturePolicyProvider;
import eu.europa.esig.dss.spi.validation.CommonCertificateVerifier;
import eu.europa.esig.dss.spi.x509.CommonTrustedCertificateSource;
import eu.europa.esig.dss.spi.x509.revocation.crl.ExternalResourcesCRLSource;
import eu.europa.esig.dss.validation.SignedDocumentValidator;
import eu.europa.esig.dss.validation.reports.Reports;

import java.io.File;
import java.io.FileInputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ValidateFacturae {
  static String q(Object o) {
    if (o == null) return "null";
    String s = String.valueOf(o).replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "");
    return "\"" + s + "\"";
  }

  public static void main(String[] args) throws Exception {
    CommonTrustedCertificateSource trusted = new CommonTrustedCertificateSource();
    try (FileInputStream in = new FileInputStream(args[0])) {
      trusted.addCertificate(DSSUtils.loadCertificate(in));
    }
    String policyUrl = "http://www.facturae.es/politica_de_firma_formato_facturae/politica_de_firma_formato_facturae_v3_1.pdf";
    for (int i = 3; i < args.length; i++) {
      CommonCertificateVerifier cv = new CommonCertificateVerifier();
      cv.setTrustedCertSources(trusted);
      cv.setCrlSource(new ExternalResourcesCRLSource(new FileDocument(new File(args[1]))));
      SignaturePolicyProvider spp = new SignaturePolicyProvider();
      Map<String, DSSDocument> byUrl = new HashMap<>();
      if (!"-".equals(args[2])) byUrl.put(policyUrl, new FileDocument(new File(args[2])));
      spp.setSignaturePoliciesByUrl(byUrl);
      spp.setSignaturePoliciesById(byUrl);

      SignedDocumentValidator v = SignedDocumentValidator.fromDocument(new FileDocument(new File(args[i])));
      v.setCertificateVerifier(cv);
      v.setSignaturePolicyProvider(spp);
      Reports reports = v.validateDocument();
      SimpleReport sr = reports.getSimpleReport();
      DiagnosticData dd = reports.getDiagnosticData();

      StringBuilder out = new StringBuilder("{");
      out.append("\"file\":").append(q(new File(args[i]).getName()));
      List<String> sigs = sr.getSignatureIdList();
      out.append(",\"signatures\":").append(sigs.size());
      if (!sigs.isEmpty()) {
        String id = sigs.get(0);
        SignatureWrapper s = dd.getSignatureById(id);
        out.append(",\"indication\":").append(q(sr.getIndication(id)));
        out.append(",\"subIndication\":").append(q(sr.getSubIndication(id)));
        out.append(",\"format\":").append(q(s.getSignatureFormat()));
        out.append(",\"signatureIntact\":").append(s.isSignatureIntact());
        out.append(",\"signatureValid\":").append(s.isSignatureValid());
        out.append(",\"signingCertificateIdentified\":").append(s.isSigningCertificateIdentified());
        List<String> refs = new ArrayList<>();
        for (XmlDigestMatcher m : s.getDigestMatchers()) {
          refs.add("{\"type\":" + q(m.getType()) + ",\"uri\":" + q(m.getUri()) + ",\"found\":" + m.isDataFound() + ",\"intact\":" + m.isDataIntact() + "}");
        }
        out.append(",\"references\":[").append(String.join(",", refs)).append("]");
        out.append(",\"policyId\":").append(q(s.getPolicyId()));
        out.append(",\"policyPresent\":").append(s.isPolicyPresent());
        out.append(",\"policyIdentified\":").append(s.isPolicyIdentified());
        out.append(",\"policyDigestValid\":").append(s.isPolicyDigestValid());
        out.append(",\"policyDigest\":").append(q(s.getPolicyDigestAlgoAndValue() == null ? null
            : s.getPolicyDigestAlgoAndValue().getDigestMethod() + ":" + java.util.Base64.getEncoder().encodeToString(s.getPolicyDigestAlgoAndValue().getDigestValue())));
        out.append(",\"policyProcessingError\":").append(q(s.getPolicyProcessingError()));
        List<String> roles = new ArrayList<>();
        for (XmlSignerRole r : s.getClaimedRoles()) roles.add(q(r.getRole()));
        out.append(",\"claimedRoles\":[").append(String.join(",", roles)).append("]");
        out.append(",\"signingTime\":").append(q(s.getClaimedSigningTime()));
        List<String> errs = new ArrayList<>();
        for (eu.europa.esig.dss.jaxb.object.Message m : sr.getAdESValidationErrors(id)) errs.add(q(m.getValue()));
        for (eu.europa.esig.dss.jaxb.object.Message m : sr.getQualificationErrors(id)) errs.add(q("[qualification] " + m.getValue()));
        out.append(",\"errors\":[").append(String.join(",", errs)).append("]");
        List<String> warns = new ArrayList<>();
        for (eu.europa.esig.dss.jaxb.object.Message m : sr.getAdESValidationWarnings(id)) warns.add(q(m.getValue()));
        out.append(",\"warnings\":[").append(String.join(",", warns)).append("]");
      }
      out.append("}");
      System.out.println(out);
    }
  }
}
